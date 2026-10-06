package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.collector.ErMasterXmlParser;
import com.datalineage.entity.AssetColumnEntity;
import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.DataModelEntity;
import com.datalineage.entity.DataModelTableEntity;
import com.datalineage.entity.DataSourceEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.AssetColumnMapper;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.DataModelMapper;
import com.datalineage.mapper.DataModelTableMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
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
    private final ErMasterXmlParser erMasterXmlParser;
    private final AssetMapper assetMapper;
    private final AssetColumnMapper assetColumnMapper;
    private final DataSourceService dataSourceService;
    private final ImpactAnalysisService impactAnalysisService;

    // ------------------------------------------------------------------
    // Import
    // ------------------------------------------------------------------

    /**
     * Import an ERMaster .erm XML file as a new design baseline model.
     */
    @Transactional
    public DataModelEntity importModel(String name, String fileName, String xmlContent,
                                       String targetLayer, String targetDataSourceId, String createdBy) {
        List<ErMasterXmlParser.ModelTable> parsed = erMasterXmlParser.parse(xmlContent);
        if (parsed.isEmpty()) {
            throw new BusinessException("ERMaster XML 解析结果为空，请确认文件格式正确");
        }

        DataModelEntity model = new DataModelEntity();
        model.setName(name);
        model.setVersion("v1.0");
        model.setSourceFormat("ERMASTER_XML");
        model.setFileName(fileName);
        model.setTargetLayer(targetLayer != null ? targetLayer : "ODS");
        model.setTargetDataSourceId(targetDataSourceId);
        model.setStatus("DRAFT");
        model.setTableCount(parsed.size());
        int columnCount = parsed.stream().mapToInt(t -> t.getColumns() != null ? t.getColumns().size() : 0).sum();
        model.setColumnCount(columnCount);
        model.setRawXml(xmlContent);
        model.setCreatedBy(createdBy);
        model.setCreatedAt(LocalDateTime.now());
        model.setUpdatedAt(LocalDateTime.now());
        dataModelMapper.insert(model);

        for (ErMasterXmlParser.ModelTable mt : parsed) {
            DataModelTableEntity table = new DataModelTableEntity();
            table.setModelId(model.getId());
            table.setTableName(mt.getTableName());
            table.setTableComment(mt.getTableComment());
            List<Map<String, Object>> cols = new ArrayList<>();
            if (mt.getColumns() != null) {
                for (ErMasterXmlParser.ModelColumn mc : mt.getColumns()) {
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
            dataModelTableMapper.insert(table);
        }

        log.info("Data model imported: {} ({} tables, {} columns)", model.getId(), model.getTableCount(), columnCount);
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
