package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.collector.EtlSqlLineageParser;
import com.datalineage.collector.LayerResolver;
import com.datalineage.collector.SqlColumnLineageParser;
import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.DataSourceEntity;
import com.datalineage.entity.LayerImportRelationEntity;
import com.datalineage.entity.LineageEdgeEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.DataSourceMapper;
import com.datalineage.mapper.LayerImportRelationMapper;
import com.datalineage.mapper.LineageEdgeMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Layer import relations: declared cross-source data flows between warehouse layers
 * (e.g. "ODS source -> DWD source"). Building a relation generates lineage edges:
 *
 * <ul>
 *   <li>{@code OBJECT_NAME} mode: business-name auto match (ods_order -> dwd_order),
 *       edges tagged source=CROSS_SOURCE, confidence=70;</li>
 *   <li>{@code ETL_SQL} mode: parse registered INSERT INTO .. SELECT statements
 *       into TABLE/COLUMN edges, source=ETL_PARSER (P1).</li>
 * </ul>
 *
 * Builds are idempotent: edges are scoped by (source kind + declared endpoint boxes)
 * and rebuilt on every run; manual and contract edges are never touched.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LayerImportService {

    private static final Set<String> LAYERS = Set.of("ODS", "DWD", "DWS", "ADS", "APP");
    private static final String SRC_OBJECT_NAME = "CROSS_SOURCE";
    private static final String SRC_ETL_SQL = "ETL_PARSER";

    private final LayerImportRelationMapper relationMapper;
    private final AssetMapper assetMapper;
    private final DataSourceMapper dataSourceMapper;
    private final LineageEdgeMapper lineageEdgeMapper;
    private final EtlSqlLineageParser etlSqlLineageParser;

    // ------------------------------------------------------------------
    // CRUD
    // ------------------------------------------------------------------

    public List<Map<String, Object>> list(String fromLayer, String toLayer, String status) {
        QueryWrapper<LayerImportRelationEntity> wrapper = new QueryWrapper<>();
        if (fromLayer != null && !fromLayer.isEmpty()) wrapper.eq("from_layer", fromLayer);
        if (toLayer != null && !toLayer.isEmpty()) wrapper.eq("to_layer", toLayer);
        if (status != null && !status.isEmpty()) wrapper.eq("status", status);
        wrapper.orderByDesc("created_at");

        List<LayerImportRelationEntity> relations = relationMapper.selectList(wrapper);
        Map<String, String> dsNames = dataSourceNames();
        return relations.stream().map(rel -> toView(rel, dsNames)).collect(Collectors.toList());
    }

    public Map<String, Object> get(String id) {
        LayerImportRelationEntity rel = requireRelation(id);
        return toView(rel, dataSourceNames());
    }

    public LayerImportRelationEntity create(LayerImportRelationEntity rel) {
        validate(rel);
        rel.setStatus(rel.getStatus() == null ? "ACTIVE" : rel.getStatus());
        rel.setMatchMode(rel.getMatchMode() == null ? "OBJECT_NAME" : rel.getMatchMode());
        rel.setEdgesBuilt(0);
        rel.setCreatedAt(LocalDateTime.now());
        rel.setUpdatedAt(LocalDateTime.now());
        relationMapper.insert(rel);
        log.info("Layer import relation created: {} ({} {} -> {} {})", rel.getId(),
                rel.getFromLayer(), rel.getFromDataSourceId(), rel.getToLayer(), rel.getToDataSourceId());
        return rel;
    }

    public void update(String id, LayerImportRelationEntity patch) {
        LayerImportRelationEntity rel = requireRelation(id);
        if (patch.getName() != null) rel.setName(patch.getName());
        if (patch.getMatchMode() != null) rel.setMatchMode(patch.getMatchMode());
        if (patch.getEtlSql() != null) rel.setEtlSql(patch.getEtlSql());
        if (patch.getStatus() != null) rel.setStatus(patch.getStatus());
        rel.setUpdatedAt(LocalDateTime.now());
        relationMapper.updateById(rel);
    }

    /** Delete a relation and cascade-remove the edges it produced. */
    public int delete(String id) {
        LayerImportRelationEntity rel = requireRelation(id);
        int removed = removeEdges(rel);
        relationMapper.deleteById(id);
        log.info("Layer import relation {} deleted, {} edges removed", id, removed);
        return removed;
    }

    // ------------------------------------------------------------------
    // Build / Preview
    // ------------------------------------------------------------------

    /** Dry-run: compute the edges that would be built, without persisting anything. */
    public Map<String, Object> preview(String id) {
        LayerImportRelationEntity rel = requireRelation(id);
        PlanOutcome outcome = plan(rel);
        Map<String, Object> result = outcomeToView(rel, outcome);
        result.put("dryRun", true);
        return result;
    }

    /** Build (idempotent): remove previous edges of this relation, then insert fresh ones. */
    public Map<String, Object> build(String id) {
        LayerImportRelationEntity rel = requireRelation(id);
        if ("PAUSED".equalsIgnoreCase(rel.getStatus())) {
            throw new BusinessException("关系已暂停（PAUSED），请先恢复后再构建");
        }
        PlanOutcome outcome = plan(rel);

        int removed = removeEdges(rel);
        int inserted = 0;
        for (PlannedEdge p : outcome.edges) {
            LineageEdgeEntity edge = new LineageEdgeEntity();
            edge.setFromAssetId(p.fromId);
            edge.setToAssetId(p.toId);
            edge.setKind(p.kind);
            edge.setFromColumn(p.fromColumn);
            edge.setToColumn(p.toColumn);
            edge.setSource(p.source);
            edge.setConfidence(p.confidence);
            edge.setTransformExpr(p.transformExpr);
            edge.setIsCriticalPath(false);
            edge.setValidFrom(LocalDateTime.now());
            lineageEdgeMapper.insert(edge);
            inserted++;
        }

        rel.setLastBuildAt(LocalDateTime.now());
        rel.setEdgesBuilt(inserted);
        rel.setLastBuildResult(String.format("built=%d removed=%d unmatched=%d ambiguous=%d",
                inserted, removed, outcome.unmatched, outcome.ambiguous));
        rel.setUpdatedAt(LocalDateTime.now());
        relationMapper.updateById(rel);

        Map<String, Object> result = outcomeToView(rel, outcome);
        result.put("edgesRemoved", removed);
        result.put("dryRun", false);
        log.info("Layer import relation {} built: {} edges inserted, {} removed", id, inserted, removed);
        return result;
    }

    // ------------------------------------------------------------------
    // Stats (for the layer-source matrix UI)
    // ------------------------------------------------------------------

    public Map<String, Object> stats() {
        // Asset counts per (layer, data source)
        List<Map<String, Object>> rows = assetMapper.selectMaps(new QueryWrapper<AssetEntity>()
                .select("layer", "data_source_id", "COUNT(*) AS cnt")
                .isNotNull("data_source_id")
                .groupBy("layer", "data_source_id"));

        Map<String, String> dsNames = dataSourceNames();
        List<Map<String, Object>> layers = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            String dsId = String.valueOf(row.get("data_source_id"));
            item.put("layer", row.get("layer"));
            item.put("dataSourceId", dsId);
            item.put("dataSourceName", dsNames.getOrDefault(dsId, dsId));
            item.put("assetCount", row.get("cnt"));
            layers.add(item);
        }
        layers.sort(Comparator.comparing(a -> String.valueOf(a.get("layer"))));

        List<Map<String, Object>> relations = list(null, null, null);
        Long crossEdges = lineageEdgeMapper.selectCount(new QueryWrapper<LineageEdgeEntity>()
                .in("source", SRC_OBJECT_NAME, SRC_ETL_SQL));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("layers", layers);
        result.put("relations", relations);
        result.put("crossSourceEdges", crossEdges);
        return result;
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    /** A planned lineage edge: kind TABLE (table-to-table) or COLUMN (column mapping). */
    private static class PlannedEdge {
        String fromId;
        String toId;
        String kind;
        String fromColumn;
        String toColumn;
        String source;
        int confidence;
        String transformExpr;

        PlannedEdge(String fromId, String toId, String kind, String fromColumn, String toColumn,
                    String source, int confidence, String transformExpr) {
            this.fromId = fromId;
            this.toId = toId;
            this.kind = kind;
            this.fromColumn = fromColumn;
            this.toColumn = toColumn;
            this.source = source;
            this.confidence = confidence;
            this.transformExpr = transformExpr;
        }
    }

    /** Planned edges plus the match statistics of a dry-run/build. */
    private static class PlanOutcome {
        final List<PlannedEdge> edges = new ArrayList<>();
        final List<String> unmatchedTargets = new ArrayList<>();
        final List<String> ambiguousTargets = new ArrayList<>();
        int unmatched;
        int ambiguous;
    }

    /** Compute the planned edges for a relation according to its match mode. */
    private PlanOutcome plan(LayerImportRelationEntity rel) {
        return SRC_ETL_SQL.equals(matchModeSource(rel)) ? planByEtlSql(rel) : planByObjectName(rel);
    }

    private String matchModeSource(LayerImportRelationEntity rel) {
        return "ETL_SQL".equalsIgnoreCase(rel.getMatchMode()) ? SRC_ETL_SQL : SRC_OBJECT_NAME;
    }

    /**
     * Business-name auto match: strip the layer prefix from both sides and connect the
     * unique candidate (ods_order -> dwd_order). Ambiguous (same business name mapped
     * by multiple objects) and unmatched targets are reported, not guessed.
     */
    private PlanOutcome planByObjectName(LayerImportRelationEntity rel) {
        List<AssetEntity> fromAssets = listAssets(rel.getFromDataSourceId(), rel.getFromLayer());
        List<AssetEntity> toAssets = listAssets(rel.getToDataSourceId(), rel.getToLayer());

        Map<String, List<AssetEntity>> index = new HashMap<>();
        for (AssetEntity a : fromAssets) {
            index.computeIfAbsent(businessName(a.getName()), k -> new ArrayList<>()).add(a);
        }

        PlanOutcome outcome = new PlanOutcome();
        String tag = "relation:" + rel.getId();
        for (AssetEntity to : toAssets) {
            List<AssetEntity> candidates = index.get(businessName(to.getName()));
            if (candidates == null || candidates.isEmpty()) {
                outcome.unmatched++;
                outcome.unmatchedTargets.add(to.getName());
                continue;
            }
            if (candidates.size() > 1) {
                outcome.ambiguous++;
                outcome.ambiguousTargets.add(to.getName());
                continue;
            }
            AssetEntity from = candidates.get(0);
            if (from.getId().equals(to.getId())) {
                continue;
            }
            outcome.edges.add(new PlannedEdge(from.getId(), to.getId(), "TABLE", null, null,
                    SRC_OBJECT_NAME, 70, tag));
        }
        return outcome;
    }

    /**
     * ETL SQL mode: parse the registered INSERT INTO .. SELECT statements into TABLE and
     * COLUMN edges. Unqualified table names are resolved by object name inside the declared
     * (data source x layer) box; names hitting multiple objects must be schema-qualified in
     * the SQL. Endpoints outside the box are reported, never linked.
     */
    private PlanOutcome planByEtlSql(LayerImportRelationEntity rel) {
        List<EtlSqlLineageParser.InsertLineage> statements = etlSqlLineageParser.parse(rel.getEtlSql());
        if (statements.isEmpty()) {
            throw new BusinessException("ETL SQL 中未解析出任何 INSERT INTO .. SELECT 语句，请检查语句");
        }

        BoxIndex fromBox = boxIndex(rel.getFromDataSourceId(), rel.getFromLayer());
        BoxIndex toBox = boxIndex(rel.getToDataSourceId(), rel.getToLayer());

        PlanOutcome outcome = new PlanOutcome();
        String tag = "relation:" + rel.getId();
        Set<String> dedup = new LinkedHashSet<>();
        for (EtlSqlLineageParser.InsertLineage stmt : statements) {
            Endpoint to = resolveEndpoint(toBox, stmt.getTargetSchema(), stmt.getTargetTable());
            if (to.asset == null) {
                reportMissing(outcome, to, qualified(stmt.getTargetSchema(), stmt.getTargetTable()),
                        "目标层 " + rel.getToLayer());
                continue;
            }

            for (EtlSqlLineageParser.TableRef src : stmt.getSources()) {
                Endpoint from = resolveEndpoint(fromBox, src.getSchema(), src.getTable());
                if (from.asset == null) {
                    reportMissing(outcome, from, qualified(src.getSchema(), src.getTable()),
                            "源层 " + rel.getFromLayer());
                    continue;
                }
                if (dedup.add(from.asset.getId() + "->" + to.asset.getId())) {
                    outcome.edges.add(new PlannedEdge(from.asset.getId(), to.asset.getId(), "TABLE",
                            null, null, SRC_ETL_SQL, 90, tag));
                }
            }

            for (SqlColumnLineageParser.ColumnMapping mapping : stmt.getColumns()) {
                Endpoint from = resolveEndpoint(fromBox, mapping.getSourceSchema(), mapping.getSourceTable());
                if (from.asset == null) {
                    continue; // table-level validation above already reported it
                }
                String key = from.asset.getId() + "->" + to.asset.getId()
                        + "#" + mapping.getSourceColumn() + ":" + mapping.getTargetColumn();
                if (dedup.add(key)) {
                    outcome.edges.add(new PlannedEdge(from.asset.getId(), to.asset.getId(), "COLUMN",
                            mapping.getSourceColumn(), mapping.getTargetColumn(),
                            SRC_ETL_SQL, mapping.getConfidence(), mapping.getTransformExpr()));
                }
            }
        }
        return outcome;
    }

    /** Count and describe an endpoint that could not be linked (missing or ambiguous). */
    private void reportMissing(PlanOutcome outcome, Endpoint endpoint, String name, String boxLabel) {
        if (endpoint.ambiguous) {
            outcome.ambiguous++;
            outcome.ambiguousTargets.add(name + " (" + boxLabel + " 命中多个对象，请在 SQL 中写明 schema)");
        } else {
            outcome.unmatched++;
            outcome.unmatchedTargets.add(name + " (" + boxLabel + " 中不存在)");
        }
    }

    /** A (data source x layer) endpoint box indexed by full asset id and by object name. */
    private static class BoxIndex {
        final Map<String, AssetEntity> byId = new HashMap<>();
        final Map<String, List<AssetEntity>> byName = new HashMap<>();
    }

    /** Endpoint lookup result: missing, ambiguous, or a unique asset. */
    private static class Endpoint {
        final AssetEntity asset;
        final boolean ambiguous;

        Endpoint(AssetEntity asset, boolean ambiguous) {
            this.asset = asset;
            this.ambiguous = ambiguous;
        }
    }

    private BoxIndex boxIndex(String dataSourceId, String layer) {
        BoxIndex box = new BoxIndex();
        for (AssetEntity a : listAssets(dataSourceId, layer)) {
            box.byId.put(a.getId().toLowerCase(), a);
            box.byName.computeIfAbsent(a.getName().toLowerCase(), k -> new ArrayList<>()).add(a);
        }
        return box;
    }

    /**
     * Resolve a parsed (schema, table) endpoint: schema-qualified names match the full
     * asset id; bare names match the object name, flagging ambiguity when several schemas
     * hold the same name.
     */
    private Endpoint resolveEndpoint(BoxIndex box, String schema, String table) {
        if (table == null) {
            return new Endpoint(null, false);
        }
        if (schema != null) {
            return new Endpoint(box.byId.get(assetKey(schema, table)), false);
        }
        List<AssetEntity> candidates = box.byName.get(table.toLowerCase());
        if (candidates == null || candidates.isEmpty()) {
            return new Endpoint(null, false);
        }
        if (candidates.size() > 1) {
            return new Endpoint(null, true);
        }
        return new Endpoint(candidates.get(0), false);
    }

    private String assetKey(String schema, String table) {
        return ("asset:" + schema + "." + table).toLowerCase();
    }

    private String qualified(String schema, String table) {
        return schema == null ? table : schema + "." + table;
    }

    private List<AssetEntity> listAssets(String dataSourceId, String layer) {
        return assetMapper.selectList(new QueryWrapper<AssetEntity>()
                .eq("data_source_id", dataSourceId)
                .eq("layer", layer));
    }

    private String businessName(String name) {
        String stripped = LayerResolver.stripLayerPrefix(name);
        return stripped == null ? "" : stripped.toLowerCase();
    }

    private int removeEdges(LayerImportRelationEntity rel) {
        String source = matchModeSource(rel);
        return lineageEdgeMapper.deleteRelationEdges(source,
                rel.getFromDataSourceId(), rel.getFromLayer(),
                rel.getToDataSourceId(), rel.getToLayer());
    }

    private Map<String, Object> outcomeToView(LayerImportRelationEntity rel, PlanOutcome outcome) {
        Map<String, String> nameCache = new HashMap<>();
        List<Map<String, Object>> edges = outcome.edges.stream().map(p -> {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("fromAssetId", p.fromId);
            e.put("toAssetId", p.toId);
            e.put("fromName", assetName(p.fromId, nameCache));
            e.put("toName", assetName(p.toId, nameCache));
            e.put("kind", p.kind);
            e.put("fromColumn", p.fromColumn);
            e.put("toColumn", p.toColumn);
            e.put("source", p.source);
            e.put("confidence", p.confidence);
            return e;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("relationId", rel.getId());
        result.put("matchMode", rel.getMatchMode());
        result.put("edgesPlanned", outcome.edges.size());
        result.put("unmatched", outcome.unmatched);
        result.put("ambiguous", outcome.ambiguous);
        result.put("unmatchedTargets", outcome.unmatchedTargets);
        result.put("ambiguousTargets", outcome.ambiguousTargets);
        result.put("edges", edges);
        return result;
    }

    private String assetName(String assetId, Map<String, String> cache) {
        return cache.computeIfAbsent(assetId, id -> {
            AssetEntity a = assetMapper.selectById(id);
            return a == null ? id : a.getName();
        });
    }

    private Map<String, Object> toView(LayerImportRelationEntity rel, Map<String, String> dsNames) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", rel.getId());
        item.put("name", rel.getName());
        item.put("fromLayer", rel.getFromLayer());
        item.put("toLayer", rel.getToLayer());
        item.put("fromDataSourceId", rel.getFromDataSourceId());
        item.put("fromDataSourceName", dsNames.getOrDefault(rel.getFromDataSourceId(), rel.getFromDataSourceId()));
        item.put("toDataSourceId", rel.getToDataSourceId());
        item.put("toDataSourceName", dsNames.getOrDefault(rel.getToDataSourceId(), rel.getToDataSourceId()));
        item.put("matchMode", rel.getMatchMode());
        item.put("etlSql", rel.getEtlSql());
        item.put("status", rel.getStatus());
        item.put("lastBuildAt", rel.getLastBuildAt());
        item.put("lastBuildResult", rel.getLastBuildResult());
        item.put("edgesBuilt", rel.getEdgesBuilt());
        return item;
    }

    private Map<String, String> dataSourceNames() {
        return dataSourceMapper.selectList(null).stream()
                .collect(Collectors.toMap(DataSourceEntity::getId, DataSourceEntity::getName, (a, b) -> a));
    }

    private LayerImportRelationEntity requireRelation(String id) {
        LayerImportRelationEntity rel = relationMapper.selectById(id);
        if (rel == null) {
            throw new BusinessException("层间关系不存在: " + id);
        }
        return rel;
    }

    private void validate(LayerImportRelationEntity rel) {
        if (rel.getName() == null || rel.getName().trim().isEmpty()) {
            throw new BusinessException("关系名称不能为空");
        }
        if (!LAYERS.contains(rel.getFromLayer()) || !LAYERS.contains(rel.getToLayer())) {
            throw new BusinessException("层必须为 ODS/DWD/DWS/ADS/APP 之一");
        }
        if (rel.getFromDataSourceId() == null || rel.getToDataSourceId() == null) {
            throw new BusinessException("必须指定源/目标数据源");
        }
        if (rel.getFromDataSourceId().equals(rel.getToDataSourceId())
                && rel.getFromLayer().equals(rel.getToLayer())) {
            throw new BusinessException("源与目标不能是同一数据源的同一层");
        }
        if (dataSourceMapper.selectById(rel.getFromDataSourceId()) == null) {
            throw new BusinessException("源数据源不存在: " + rel.getFromDataSourceId());
        }
        if (dataSourceMapper.selectById(rel.getToDataSourceId()) == null) {
            throw new BusinessException("目标数据源不存在: " + rel.getToDataSourceId());
        }
        if ("ETL_SQL".equalsIgnoreCase(rel.getMatchMode())
                && (rel.getEtlSql() == null || rel.getEtlSql().trim().isEmpty())) {
            throw new BusinessException("ETL_SQL 模式必须提供 etl_sql 语句");
        }
    }
}
