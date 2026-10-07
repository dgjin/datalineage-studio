package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.AssetColumnEntity;
import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.DataModelEntity;
import com.datalineage.entity.DataModelTableEntity;
import com.datalineage.entity.DataModelVersionEntity;
import com.datalineage.entity.DataSourceEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.AssetColumnMapper;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.DataModelMapper;
import com.datalineage.mapper.DataModelTableMapper;
import com.datalineage.mapper.DataModelVersionMapper;
import com.datalineage.parser.ModelColumn;
import com.datalineage.parser.ModelParser;
import com.datalineage.parser.ModelTable;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Data model baseline management: import ERMaster design models, diff against
 * live ODS schema, and auto-evaluate downstream impact for each difference.
 *
 * <p>Design models live in their own tables (data_models / data_model_tables)
 * and never pollute the asset catalog until explicitly synced.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataModelService {

    private final DataModelMapper dataModelMapper;
    private final DataModelTableMapper dataModelTableMapper;
    private final DataModelVersionMapper dataModelVersionMapper;
    /** Format adapters (.erm / .pdm); Spring injects every registered ModelParser. */
    private final List<ModelParser> modelParsers;
    private final AssetMapper assetMapper;
    private final AssetColumnMapper assetColumnMapper;
    private final DataSourceService dataSourceService;
    private final ImpactAnalysisService impactAnalysisService;

    // ------------------------------------------------------------------
    // Import
    // ------------------------------------------------------------------

    /**
     * Import a design model file (.erm / .pdm). Re-importing the same model name
     * bumps the version chain instead of duplicating: the current table snapshot
     * is replaced by the latest import and every import is archived in
     * data_model_versions (raw file + counts) for version compare/replay.
     */
    @Transactional
    public DataModelEntity importModel(String name, String fileName, String xmlContent,
                                       String targetLayer, String targetDataSourceId, String createdBy) {
        ModelParser parser = selectParser(fileName, xmlContent);
        List<ModelTable> parsed = parser.parse(xmlContent);
        if (parsed.isEmpty()) {
            throw new BusinessException("模型文件解析结果为空，请确认格式正确（支持 ERMaster .erm / PowerDesigner .pdm）");
        }

        DataModelEntity existing = dataModelMapper.selectOne(
                new QueryWrapper<DataModelEntity>().eq("name", name).last("LIMIT 1"));

        DataModelEntity model;
        int versionNo;
        if (existing != null) {
            // Same model name -> version bump on the existing baseline
            model = existing;
            versionNo = currentMaxVersionNo(model.getId()) + 1;
            model.setVersion("v" + versionNo + ".0");
            model.setSourceFormat(parser.format());
            model.setFileName(fileName);
            if (targetLayer != null && !targetLayer.isBlank()) model.setTargetLayer(targetLayer);
            if (targetDataSourceId != null && !targetDataSourceId.isBlank()) {
                model.setTargetDataSourceId(targetDataSourceId);
            }
            applyParsedStats(model, parsed);
            model.setRawXml(xmlContent);
            if (createdBy != null && !createdBy.isBlank()) model.setCreatedBy(createdBy);
            model.setUpdatedAt(LocalDateTime.now());
            dataModelMapper.updateById(model);

            // The latest import replaces the previous table snapshot
            dataModelTableMapper.delete(new QueryWrapper<DataModelTableEntity>().eq("model_id", model.getId()));
        } else {
            model = new DataModelEntity();
            versionNo = 1;
            model.setName(name);
            model.setVersion("v1.0");
            model.setSourceFormat(parser.format());
            model.setFileName(fileName);
            model.setTargetLayer(targetLayer != null ? targetLayer : "ODS");
            model.setTargetDataSourceId(targetDataSourceId);
            model.setStatus("DRAFT");
            applyParsedStats(model, parsed);
            model.setRawXml(xmlContent);
            model.setCreatedBy(createdBy);
            model.setCreatedAt(LocalDateTime.now());
            model.setUpdatedAt(LocalDateTime.now());
            dataModelMapper.insert(model);
        }

        insertTableSnapshots(model.getId(), parsed);
        archiveVersion(model, versionNo, fileName, xmlContent, parsed, createdBy);

        log.info("Data model {} imported as v{} ({} tables, {} columns, format={})",
                model.getId(), versionNo, model.getTableCount(), model.getColumnCount(), parser.format());
        return model;
    }

    // ------------------------------------------------------------------
    // Query
    // ------------------------------------------------------------------

    public List<DataModelEntity> listModels() {
        return dataModelMapper.selectList(new QueryWrapper<DataModelEntity>().orderByDesc("created_at"));
    }

    public DataModelEntity getModel(String id) {
        return dataModelMapper.selectById(id);
    }

    public List<DataModelTableEntity> listModelTables(String modelId) {
        return dataModelTableMapper.findByModelId(modelId);
    }

    // ------------------------------------------------------------------
    // Version query / compare / export
    // ------------------------------------------------------------------

    /** Version history without raw_xml payloads (heavy MEDIUMTEXT column). */
    public List<DataModelVersionEntity> listVersions(String modelId) {
        requireModel(modelId);
        return dataModelVersionMapper.selectList(new QueryWrapper<DataModelVersionEntity>()
                .select("id", "model_id", "version_no", "version_label", "file_name",
                        "table_count", "column_count", "imported_by", "created_at")
                .eq("model_id", modelId)
                .orderByDesc("version_no"));
    }

    /** Replay one archived version by re-parsing its raw file content. */
    public List<DataModelTableEntity> versionTables(String versionId) {
        DataModelVersionEntity version = requireVersion(versionId);
        ModelParser parser = selectParser(version.getFileName(), version.getRawXml());
        List<DataModelTableEntity> result = new ArrayList<>();
        for (ModelTable table : parser.parse(version.getRawXml())) {
            result.add(toSnapshotEntity(version.getModelId(), table));
        }
        return result;
    }

    /**
     * Structural diff between two archived versions (tables + columns only).
     * {@code from} defaults to the previous version (0 = explicit empty
     * baseline); {@code to} defaults to the newest version.
     */
    public Map<String, Object> diffVersions(String modelId, Integer fromNo, Integer toNo) {
        DataModelEntity model = requireModel(modelId);
        List<DataModelVersionEntity> versions = dataModelVersionMapper.findByModelId(modelId);
        if (versions.isEmpty()) {
            throw new BusinessException("模型暂无版本记录，请先重新导入以生成版本快照");
        }
        DataModelVersionEntity toV = toNo == null ? versions.get(0) : requireVersionNo(modelId, toNo);
        DataModelVersionEntity fromV;
        if (fromNo != null && fromNo > 0) {
            fromV = requireVersionNo(modelId, fromNo);
        } else if (fromNo != null) {
            // Explicit empty baseline (from=0): every table counts as added
            fromV = null;
        } else {
            fromV = versions.stream()
                    .filter(v -> v.getVersionNo() != null && v.getVersionNo() < toV.getVersionNo())
                    .max(Comparator.comparingInt(DataModelVersionEntity::getVersionNo))
                    .orElse(null);
        }

        Map<String, ModelTable> fromTables = fromV == null
                ? new LinkedHashMap<>() : parseVersionTableMap(fromV);
        Map<String, ModelTable> toTables = parseVersionTableMap(toV);

        List<Map<String, Object>> tablesAdded = new ArrayList<>();
        List<Map<String, Object>> tablesRemoved = new ArrayList<>();
        List<Map<String, Object>> columnsAdded = new ArrayList<>();
        List<Map<String, Object>> columnsRemoved = new ArrayList<>();
        List<Map<String, Object>> columnsChanged = new ArrayList<>();

        for (Map.Entry<String, ModelTable> entry : toTables.entrySet()) {
            ModelTable toTable = entry.getValue();
            ModelTable fromTable = fromTables.get(entry.getKey());
            if (fromTable == null) {
                tablesAdded.add(tableSummary(toTable));
                continue;
            }
            Map<String, ModelColumn> fromCols = columnsByName(fromTable);
            Map<String, ModelColumn> toCols = columnsByName(toTable);
            for (Map.Entry<String, ModelColumn> colEntry : toCols.entrySet()) {
                ModelColumn toCol = colEntry.getValue();
                ModelColumn fromCol = fromCols.get(colEntry.getKey());
                if (fromCol == null) {
                    columnsAdded.add(columnDiff(toTable.getTableName(), toCol.getName(),
                            null, toCol.getFullType()));
                } else if (!toCol.getFullType().equalsIgnoreCase(fromCol.getFullType())) {
                    columnsChanged.add(columnDiff(toTable.getTableName(), toCol.getName(),
                            fromCol.getFullType(), toCol.getFullType()));
                }
            }
            for (Map.Entry<String, ModelColumn> colEntry : fromCols.entrySet()) {
                if (!toCols.containsKey(colEntry.getKey())) {
                    columnsRemoved.add(columnDiff(toTable.getTableName(), colEntry.getValue().getName(),
                            colEntry.getValue().getFullType(), null));
                }
            }
        }
        for (Map.Entry<String, ModelTable> entry : fromTables.entrySet()) {
            if (!toTables.containsKey(entry.getKey())) {
                tablesRemoved.add(tableSummary(entry.getValue()));
            }
        }

        Map<String, Integer> summary = new LinkedHashMap<>();
        summary.put("tablesAdded", tablesAdded.size());
        summary.put("tablesRemoved", tablesRemoved.size());
        summary.put("columnsAdded", columnsAdded.size());
        summary.put("columnsRemoved", columnsRemoved.size());
        summary.put("columnsChanged", columnsChanged.size());
        summary.put("total", tablesAdded.size() + tablesRemoved.size() + columnsAdded.size()
                + columnsRemoved.size() + columnsChanged.size());

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("modelId", modelId);
        report.put("modelName", model.getName());
        report.put("fromVersion", fromV == null ? null : versionSummary(fromV));
        report.put("toVersion", versionSummary(toV));
        report.put("summary", summary);
        report.put("tablesAdded", tablesAdded);
        report.put("tablesRemoved", tablesRemoved);
        report.put("columnsAdded", columnsAdded);
        report.put("columnsRemoved", columnsRemoved);
        report.put("columnsChanged", columnsChanged);
        report.put("comparedAt", LocalDateTime.now().toString());
        return report;
    }

    /**
     * Render the version diff as a downloadable document. Returns a payload of
     * {fileName, contentType, content(bytes)} for the controller to stream.
     */
    public Map<String, Object> exportCompareReport(String modelId, Integer fromNo, Integer toNo, String format) {
        Map<String, Object> diff = diffVersions(modelId, fromNo, toNo);
        boolean csv = "csv".equalsIgnoreCase(format != null ? format.trim() : "");
        String fromLabel = versionLabelOf(diff.get("fromVersion"));
        String toLabel = versionLabelOf(diff.get("toVersion"));
        String modelName = Objects.toString(diff.get("modelName"), "model");

        StringBuilder content = new StringBuilder();
        if (csv) {
            content.append('\uFEFF'); // UTF-8 BOM so spreadsheet apps open Chinese text correctly
            content.append("diffType,table,column,fromValue,toValue\n");
            for (Map<String, Object> t : diffList(diff, "tablesAdded")) {
                content.append(csvRow("TABLE_ADDED", t.get("table"), null, null, t.get("columns") + " columns"));
            }
            for (Map<String, Object> t : diffList(diff, "tablesRemoved")) {
                content.append(csvRow("TABLE_REMOVED", t.get("table"), null, t.get("columns") + " columns", null));
            }
            for (Map<String, Object> c : diffList(diff, "columnsAdded")) {
                content.append(csvRow("COLUMN_ADDED", c.get("table"), c.get("column"), null, c.get("toType")));
            }
            for (Map<String, Object> c : diffList(diff, "columnsRemoved")) {
                content.append(csvRow("COLUMN_REMOVED", c.get("table"), c.get("column"), c.get("fromType"), null));
            }
            for (Map<String, Object> c : diffList(diff, "columnsChanged")) {
                content.append(csvRow("COLUMN_CHANGED", c.get("table"), c.get("column"),
                        c.get("fromType"), c.get("toType")));
            }
        } else {
            content.append("# 模型版本对比报告\n\n");
            content.append("| 项目 | 值 |\n| --- | --- |\n");
            content.append("| 模型 | ").append(mdCell(modelName)).append(" |\n");
            content.append("| 对比范围 | ").append(mdCell(fromLabel + " → " + toLabel)).append(" |\n");
            content.append("| 生成时间 | ").append(LocalDateTime.now()).append(" |\n");

            Map<?, ?> summary = (Map<?, ?>) diff.get("summary");
            content.append("\n## 差异汇总\n\n");
            content.append("| 表新增 | 表删除 | 字段新增 | 字段删除 | 字段变更 | 合计 |\n");
            content.append("| --- | --- | --- | --- | --- | --- |\n");
            content.append("| ").append(summary.get("tablesAdded")).append(" | ")
                    .append(summary.get("tablesRemoved")).append(" | ")
                    .append(summary.get("columnsAdded")).append(" | ")
                    .append(summary.get("columnsRemoved")).append(" | ")
                    .append(summary.get("columnsChanged")).append(" | ")
                    .append(summary.get("total")).append(" |\n");

            appendMarkdownSection(content, "表新增", new String[]{"表名", "列数"},
                    diffList(diff, "tablesAdded"), new String[]{"table", "columns"});
            appendMarkdownSection(content, "表删除", new String[]{"表名", "列数"},
                    diffList(diff, "tablesRemoved"), new String[]{"table", "columns"});
            appendMarkdownSection(content, "字段新增", new String[]{"表", "字段", "类型"},
                    diffList(diff, "columnsAdded"), new String[]{"table", "column", "toType"});
            appendMarkdownSection(content, "字段删除", new String[]{"表", "字段", "类型"},
                    diffList(diff, "columnsRemoved"), new String[]{"table", "column", "fromType"});
            appendMarkdownSection(content, "字段变更", new String[]{"表", "字段", "原类型", "新类型"},
                    diffList(diff, "columnsChanged"), new String[]{"table", "column", "fromType", "toType"});

            if (summary.get("total") instanceof Number && ((Number) summary.get("total")).intValue() == 0) {
                content.append("\n两个版本之间无结构差异。\n");
            }
        }

        String fileName = "model-diff-" + fromLabel + "-to-" + toLabel + (csv ? ".csv" : ".md");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("fileName", fileName);
        payload.put("contentType", csv ? "text/csv;charset=UTF-8" : "text/markdown;charset=UTF-8");
        payload.put("content", content.toString().getBytes(StandardCharsets.UTF_8));
        return payload;
    }

    /** Append one markdown table section (skipped when there is nothing to show). */
    private void appendMarkdownSection(StringBuilder sb, String title, String[] headers,
                                       List<Map<String, Object>> rows, String[] keys) {
        if (rows.isEmpty()) return;
        sb.append("\n## ").append(title).append("\n\n|");
        for (String header : headers) sb.append(' ').append(header).append(" |");
        sb.append("\n|");
        for (int i = 0; i < headers.length; i++) sb.append(" --- |");
        sb.append('\n');
        for (Map<String, Object> row : rows) {
            sb.append('|');
            for (String key : keys) sb.append(' ').append(mdCell(row.get(key))).append(" |");
            sb.append('\n');
        }
    }

    // ------------------------------------------------------------------
    // Diff against live ODS
    // ------------------------------------------------------------------

    /**
     * Compare a design model against the actual schema of its target data source.
     * Returns a structured diff report; each difference is annotated with the
     * downstream impact verdict computed by the lineage engine.
     */
    public Map<String, Object> compareWithDataSource(String modelId) {
        DataModelEntity model = requireModel(modelId);
        if (model.getTargetDataSourceId() == null) {
            throw new BusinessException("模型未绑定目标数据源，无法执行对比");
        }
        DataSourceEntity ds = dataSourceService.getDataSource(model.getTargetDataSourceId());
        if (ds == null) {
            throw new BusinessException("目标数据源不存在: " + model.getTargetDataSourceId());
        }

        List<DataModelTableEntity> modelTables = dataModelTableMapper.findByModelId(modelId);
        String targetLayer = model.getTargetLayer() != null ? model.getTargetLayer() : "ODS";

        // Load actual ODS assets for this data source + layer
        List<AssetEntity> actualAssets = assetMapper.selectList(
                new QueryWrapper<AssetEntity>()
                        .eq("data_source_id", ds.getId())
                        .eq("layer", targetLayer));
        Map<String, AssetEntity> actualByName = actualAssets.stream()
                .collect(Collectors.toMap(a -> normalizeName(a.getName()), a -> a, (a, b) -> a));

        List<Map<String, Object>> differences = new ArrayList<>();
        Set<String> modelTableNames = new HashSet<>();

        for (DataModelTableEntity mt : modelTables) {
            String normName = normalizeName(mt.getTableName());
            modelTableNames.add(normName);
            AssetEntity actual = actualByName.get(normName);

            if (actual == null) {
                differences.add(buildDiff(modelId, mt.getTableName(), null,
                        "MISSING_IN_ODS", "模型表在实际 ODS 库中不存在", null, null, null));
                continue;
            }

            // Column-level diff
            List<AssetColumnEntity> actualCols = assetColumnMapper.findByAssetId(actual.getId());
            Map<String, AssetColumnEntity> actualColByName = actualCols.stream()
                    .collect(Collectors.toMap(c -> normalizeName(c.getName()), c -> c, (a, b) -> a));
            Set<String> modelColNames = new HashSet<>();

            if (mt.getColumns() != null) {
                for (Map<String, Object> mc : mt.getColumns()) {
                    String colName = Objects.toString(mc.get("name"), null);
                    if (colName == null) continue;
                    String normCol = normalizeName(colName);
                    modelColNames.add(normCol);
                    AssetColumnEntity actualCol = actualColByName.get(normCol);

                    if (actualCol == null) {
                        differences.add(buildDiff(modelId, mt.getTableName(), colName,
                                "COLUMN_MISSING", "模型字段在实际 ODS 表中不存在",
                                Objects.toString(mc.get("type"), null), null, null));
                    } else {
                        String modelType = normalizeType(Objects.toString(mc.get("type"), null));
                        String actualType = normalizeType(actualCol.getType());
                        if (!modelType.equals(actualType)) {
                            differences.add(buildDiff(modelId, mt.getTableName(), colName,
                                    "COLUMN_TYPE_MISMATCH", "字段类型不一致",
                                    Objects.toString(mc.get("type"), null), actualCol.getType(), null));
                        }
                        Boolean modelNullable = (Boolean) mc.get("nullable");
                        if (modelNullable != null && !modelNullable.equals(actualCol.getNullable())) {
                            differences.add(buildDiff(modelId, mt.getTableName(), colName,
                                    "COLUMN_NULLABILITY_MISMATCH", "字段可空性不一致",
                                    modelNullable ? "NULL" : "NOT NULL",
                                    actualCol.getNullable() ? "NULL" : "NOT NULL", null));
                        }
                    }
                }
            }

            // Extra columns in ODS not present in model
            for (AssetColumnEntity actualCol : actualCols) {
                if (!modelColNames.contains(normalizeName(actualCol.getName()))) {
                    differences.add(buildDiff(modelId, mt.getTableName(), actualCol.getName(),
                            "COLUMN_EXTRA_IN_ODS", "实际 ODS 表存在模型未定义字段",
                            null, actualCol.getType(), null));
                }
            }
        }

        // Extra tables in ODS not present in model
        for (AssetEntity actual : actualAssets) {
            if (!modelTableNames.contains(normalizeName(actual.getName()))) {
                differences.add(buildDiff(modelId, actual.getName(), null,
                        "EXTRA_IN_ODS", "实际 ODS 库存在模型未定义表", null, null, null));
            }
        }

        // Auto-evaluate downstream impact for each difference
        evaluateImpactForDifferences(differences, ds.getId(), targetLayer);

        // Aggregate by layer
        Map<String, Integer> layerImpact = new LinkedHashMap<>();
        layerImpact.put("DWD", 0);
        layerImpact.put("DWS", 0);
        layerImpact.put("ADS", 0);
        layerImpact.put("APP", 0);
        for (Map<String, Object> diff : differences) {
            Object impact = diff.get("impact");
            if (impact instanceof Map) {
                Object impactedAssets = ((Map<?, ?>) impact).get("impactedAssets");
                if (impactedAssets instanceof List) {
                    for (Object item : (List<?>) impactedAssets) {
                        if (item instanceof Map) {
                            String layer = Objects.toString(((Map<?, ?>) item).get("layer"), null);
                            if (layer != null && layerImpact.containsKey(layer)) {
                                layerImpact.merge(layer, 1, Integer::sum);
                            }
                        }
                    }
                }
            }
        }

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("modelId", modelId);
        report.put("modelName", model.getName());
        report.put("targetLayer", targetLayer);
        report.put("dataSourceName", ds.getName());
        report.put("totalDifferences", differences.size());
        report.put("differences", differences);
        report.put("layerImpact", layerImpact);
        report.put("comparedAt", LocalDateTime.now().toString());
        return report;
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    private DataModelEntity requireModel(String id) {
        DataModelEntity model = dataModelMapper.selectById(id);
        if (model == null) {
            throw new BusinessException("数据模型不存在: " + id);
        }
        return model;
    }

    private DataModelVersionEntity requireVersion(String versionId) {
        DataModelVersionEntity version = dataModelVersionMapper.selectById(versionId);
        if (version == null) {
            throw new BusinessException("模型版本不存在: " + versionId);
        }
        return version;
    }

    private DataModelVersionEntity requireVersionNo(String modelId, Integer versionNo) {
        DataModelVersionEntity version = dataModelVersionMapper.selectOne(
                new QueryWrapper<DataModelVersionEntity>()
                        .eq("model_id", modelId)
                        .eq("version_no", versionNo)
                        .last("LIMIT 1"));
        if (version == null) {
            throw new BusinessException("模型版本不存在: v" + versionNo);
        }
        return version;
    }

    /** First registered parser accepting the file; ERMaster .erm and PowerDesigner .pdm are built in. */
    private ModelParser selectParser(String fileName, String content) {
        for (ModelParser parser : modelParsers) {
            if (parser.supports(fileName, content)) {
                return parser;
            }
        }
        throw new BusinessException("不支持的模型文件格式，仅支持 ERMaster .erm 与 PowerDesigner .pdm");
    }

    private int currentMaxVersionNo(String modelId) {
        DataModelVersionEntity latest = dataModelVersionMapper.selectOne(
                new QueryWrapper<DataModelVersionEntity>()
                        .select("version_no")
                        .eq("model_id", modelId)
                        .orderByDesc("version_no")
                        .last("LIMIT 1"));
        return latest != null && latest.getVersionNo() != null ? latest.getVersionNo() : 0;
    }

    private void applyParsedStats(DataModelEntity model, List<ModelTable> parsed) {
        model.setTableCount(parsed.size());
        model.setColumnCount(countColumns(parsed));
    }

    private void insertTableSnapshots(String modelId, List<ModelTable> parsed) {
        for (ModelTable table : parsed) {
            dataModelTableMapper.insert(toSnapshotEntity(modelId, table));
        }
    }

    /** Archive one import for later version compare/replay (raw file kept verbatim). */
    private void archiveVersion(DataModelEntity model, int versionNo, String fileName, String xmlContent,
                                List<ModelTable> parsed, String createdBy) {
        DataModelVersionEntity version = new DataModelVersionEntity();
        version.setModelId(model.getId());
        version.setVersionNo(versionNo);
        version.setVersionLabel("v" + versionNo + ".0");
        version.setFileName(fileName);
        version.setRawXml(xmlContent);
        version.setTableCount(parsed.size());
        version.setColumnCount(countColumns(parsed));
        version.setImportedBy(createdBy);
        version.setCreatedAt(LocalDateTime.now());
        dataModelVersionMapper.insert(version);
    }

    private int countColumns(List<ModelTable> parsed) {
        return parsed.stream()
                .mapToInt(t -> t.getColumns() != null ? t.getColumns().size() : 0)
                .sum();
    }

    /** Convert a parsed table into the persisted snapshot shape (matches legacy ERMaster import). */
    private DataModelTableEntity toSnapshotEntity(String modelId, ModelTable mt) {
        DataModelTableEntity table = new DataModelTableEntity();
        table.setModelId(modelId);
        table.setTableName(mt.getTableName());
        table.setTableComment(mt.getTableComment());
        List<Map<String, Object>> cols = new ArrayList<>();
        if (mt.getColumns() != null) {
            for (ModelColumn mc : mt.getColumns()) {
                Map<String, Object> col = new HashMap<>();
                col.put("name", mc.getName());
                col.put("type", mc.getFullType());
                col.put("nullable", mc.getNullable());
                col.put("isPrimary", mc.getIsPrimary());
                col.put("comment", mc.getComment());
                cols.add(col);
            }
        }
        table.setColumns(cols);
        List<Map<String, Object>> rels = new ArrayList<>();
        if (mt.getRelations() != null) {
            for (Map<String, String> r : mt.getRelations()) {
                rels.add(new HashMap<>(r));
            }
        }
        table.setRelations(rels);
        return table;
    }

    /** Parsed version content keyed by normalized table name (display names preserved). */
    private Map<String, ModelTable> parseVersionTableMap(DataModelVersionEntity version) {
        ModelParser parser = selectParser(version.getFileName(), version.getRawXml());
        Map<String, ModelTable> byName = new LinkedHashMap<>();
        for (ModelTable table : parser.parse(version.getRawXml())) {
            if (table.getTableName() != null && !table.getTableName().isEmpty()) {
                byName.put(normalizeName(table.getTableName()), table);
            }
        }
        return byName;
    }

    /** Columns of one parsed table keyed by normalized column name. */
    private Map<String, ModelColumn> columnsByName(ModelTable table) {
        Map<String, ModelColumn> cols = new LinkedHashMap<>();
        if (table != null && table.getColumns() != null) {
            for (ModelColumn c : table.getColumns()) {
                if (c.getName() != null) {
                    cols.put(normalizeName(c.getName()), c);
                }
            }
        }
        return cols;
    }

    private Map<String, Object> tableSummary(ModelTable table) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("table", table.getTableName());
        summary.put("comment", table.getTableComment());
        summary.put("columns", table.getColumns() != null ? table.getColumns().size() : 0);
        return summary;
    }

    private Map<String, Object> columnDiff(String table, String column, String fromType, String toType) {
        Map<String, Object> diff = new LinkedHashMap<>();
        diff.put("table", table);
        diff.put("column", column);
        diff.put("fromType", fromType);
        diff.put("toType", toType);
        return diff;
    }

    private Map<String, Object> versionSummary(DataModelVersionEntity version) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("versionNo", version.getVersionNo());
        summary.put("versionLabel", version.getVersionLabel());
        summary.put("fileName", version.getFileName());
        summary.put("tableCount", version.getTableCount());
        summary.put("columnCount", version.getColumnCount());
        summary.put("importedBy", version.getImportedBy());
        summary.put("createdAt", version.getCreatedAt() != null ? version.getCreatedAt().toString() : null);
        return summary;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> diffList(Map<String, Object> diff, String key) {
        Object value = diff.get(key);
        return value instanceof List ? (List<Map<String, Object>>) value : new ArrayList<>();
    }

    private String versionLabelOf(Object version) {
        if (version instanceof Map) {
            Object label = ((Map<?, ?>) version).get("versionLabel");
            if (label != null) return String.valueOf(label);
        }
        return "baseline";
    }

    private String csvRow(Object... cells) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < cells.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(csvCell(cells[i]));
        }
        return sb.append('\n').toString();
    }

    private String csvCell(Object value) {
        if (value == null) return "";
        String text = String.valueOf(value);
        if (text.contains(",") || text.contains("\"") || text.contains("\n")) {
            return '"' + text.replace("\"", "\"\"") + '"';
        }
        return text;
    }

    private String mdCell(Object value) {
        return value == null ? "" : String.valueOf(value).replace("|", "\\|");
    }

    private Map<String, Object> buildDiff(String modelId, String tableName, String columnName,
                                          String diffType, String message,
                                          String modelValue, String actualValue, String assetId) {
        Map<String, Object> diff = new LinkedHashMap<>();
        diff.put("modelId", modelId);
        diff.put("tableName", tableName);
        diff.put("columnName", columnName);
        diff.put("diffType", diffType);
        diff.put("message", message);
        diff.put("modelValue", modelValue);
        diff.put("actualValue", actualValue);
        diff.put("assetId", assetId);
        return diff;
    }

    /**
     * For each difference, resolve the corresponding asset id and run the
     * existing impact analysis so the report shows downstream blast radius.
     */
    private void evaluateImpactForDifferences(List<Map<String, Object>> differences,
                                              String dataSourceId, String targetLayer) {
        for (Map<String, Object> diff : differences) {
            String tableName = Objects.toString(diff.get("tableName"), null);
            if (tableName == null) continue;

            // Resolve asset id: try direct name match within the target data source + layer
            AssetEntity asset = assetMapper.selectOne(
                    new QueryWrapper<AssetEntity>()
                            .eq("data_source_id", dataSourceId)
                            .eq("layer", targetLayer)
                            .eq("name", tableName)
                            .last("LIMIT 1"));
            if (asset == null) {
                // Fallback: try any layer (model table may map to another layer's asset)
                asset = assetMapper.selectOne(
                        new QueryWrapper<AssetEntity>()
                                .eq("name", tableName)
                                .last("LIMIT 1"));
            }
            if (asset == null) {
                diff.put("impact", null);
                continue;
            }

            diff.put("assetId", asset.getId());
            try {
                Map<String, Object> impact = impactAnalysisService.analyzeImpact(asset.getId());
                diff.put("impact", impact);
            } catch (Exception e) {
                log.debug("Impact evaluation failed for {}: {}", asset.getId(), e.getMessage());
                diff.put("impact", null);
            }
        }
    }

    /** Normalize table/column names for comparison: lower-case, strip underscores. */
    private String normalizeName(String name) {
        if (name == null) return "";
        return name.toLowerCase().replace("_", "");
    }

    /** Normalize type for comparison: lower-case, strip length/precision. */
    private String normalizeType(String type) {
        if (type == null) return "";
        return type.toLowerCase().replaceAll("\\(.*\\)", "").trim();
    }
}
