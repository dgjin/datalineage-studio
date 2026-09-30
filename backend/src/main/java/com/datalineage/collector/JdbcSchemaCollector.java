package com.datalineage.collector;

import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.AssetColumnEntity;
import com.datalineage.entity.ChangeEventEntity;
import com.datalineage.entity.DataSourceEntity;
import com.datalineage.entity.LineageEdgeEntity;
import com.datalineage.entity.MetadataCollectTaskEntity;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.AssetColumnMapper;
import com.datalineage.mapper.ChangeEventMapper;
import com.datalineage.mapper.LineageEdgeMapper;
import com.datalineage.service.DataSourceService;
import com.datalineage.service.SchemaVersionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jasypt.encryption.StringEncryptor;
import org.springframework.stereotype.Component;

import java.sql.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class JdbcSchemaCollector {

    private final DataSourceService dataSourceService;
    private final AssetMapper assetMapper;
    private final AssetColumnMapper assetColumnMapper;
    private final LineageEdgeMapper lineageEdgeMapper;
    private final ChangeEventMapper changeEventMapper;
    private final StringEncryptor stringEncryptor;
    private final SqlColumnLineageParser columnLineageParser;
    private final SchemaVersionService schemaVersionService;

    /**
     * Execute metadata collection task
     */
    public CollectResult collect(MetadataCollectTaskEntity task) {
        CollectResult result = new CollectResult();
        result.setTaskId(task.getId());
        result.setStartTime(LocalDateTime.now());
        
        DataSourceEntity ds = dataSourceService.getDataSource(task.getDataSourceId());
        if (ds == null) {
            result.setSuccess(false);
            result.setErrorMessage("Data source not found: " + task.getDataSourceId());
            return result;
        }
        if ("INACTIVE".equalsIgnoreCase(ds.getStatus())) {
            result.setSuccess(false);
            result.setErrorMessage("数据源已停用（INACTIVE），请先在数据源管理中启用后再运行采集");
            return result;
        }

        String url = buildJdbcUrl(ds);
        String password = stringEncryptor.decrypt(ds.getPasswordEncrypted());
        
        try (Connection conn = DriverManager.getConnection(url, ds.getUsername(), password)) {
            DatabaseMetaData metaData = conn.getMetaData();
            
            // Get schemas to scan
            List<String> schemas = getTargetSchemas(task, metaData);
            result.setSchemasScanned(schemas.size());
            
            for (String schema : schemas) {
                collectSchema(conn, metaData, schema, task, result);
            }

            // Auto-discover lineage edges (FK + view dependencies) after assets are registered
            if (Boolean.TRUE.equals(task.getAutoDiscoverLineage())) {
                discoverLineage(conn, metaData, ds, schemas, result);
            }

            result.setSuccess(true);
        } catch (Exception e) {
            log.error("Collection failed for task: {}", task.getId(), e);
            result.setSuccess(false);
            result.setErrorMessage(e.getMessage());
        }
        
        result.setEndTime(LocalDateTime.now());
        return result;
    }

    private List<String> getTargetSchemas(MetadataCollectTaskEntity task, DatabaseMetaData metaData) 
            throws SQLException {
        if (task.getTargetSchemas() != null && !task.getTargetSchemas().isEmpty()) {
            return task.getTargetSchemas();
        }
        
        List<String> schemas = new ArrayList<>();
        try (ResultSet rs = metaData.getSchemas()) {
            while (rs.next()) {
                schemas.add(rs.getString("TABLE_SCHEM"));
            }
        }
        return schemas;
    }

    private void collectSchema(Connection conn, DatabaseMetaData metaData, String schema, 
                               MetadataCollectTaskEntity task, CollectResult result) throws SQLException {
        try (ResultSet rs = metaData.getTables(null, schema, "%", new String[]{"TABLE", "VIEW"})) {
            while (rs.next()) {
                String tableName = rs.getString("TABLE_NAME");
                String tableType = rs.getString("TABLE_TYPE");
                String remarks = rs.getString("REMARKS");
                
                // Resolve the table's real schema/catalog. The metadata query may return
                // tables from other databases (e.g. MySQL returns cross-database results),
                // so verify ownership before registering.
                String tableCat = rs.getString("TABLE_CAT");
                String tableSchem = rs.getString("TABLE_SCHEM");
                String actualSchema = (tableSchem != null && !tableSchem.isEmpty()) ? tableSchem : tableCat;
                if (actualSchema != null && !schema.equalsIgnoreCase(actualSchema)) {
                    continue;
                }
                
                // Check if table should be excluded
                if (shouldExclude(tableName, task.getExcludeTables())) {
                    continue;
                }
                
                // Check if table matches whitelist
                if (!matchesWhitelist(tableName, task.getTargetTables())) {
                    continue;
                }
                
                result.incrementTablesFound();
                
                // Auto-register asset if enabled
                if (task.getAutoRegisterAsset()) {
                    registerAsset(conn, metaData, schema, tableName, tableType, remarks, task, result);
                }
            }
        }
    }

    private void registerAsset(Connection conn, DatabaseMetaData metaData, String schema, String tableName, 
                               String tableType, String remarks, MetadataCollectTaskEntity task, CollectResult result) {
        String assetId = "asset:" + schema + "." + tableName;
        
        // Check if asset already exists
        AssetEntity existing = assetMapper.selectById(assetId);
        
        AssetEntity asset = new AssetEntity();
        asset.setId(assetId);
        // Layer-prefixed objects (ods_/dwd_/dws_/ads_/app_) route to their own warehouse
        // layer; anything else keeps the task default layer.
        String resolvedLayer = LayerResolver.resolve(tableName, task.getDefaultLayer());
        asset.setCode(generateAssetCode(resolvedLayer, schema, tableName));
        asset.setName(tableName);
        asset.setDisplayTitle(remarks != null ? remarks : tableName);
        asset.setType("VIEW".equals(tableType) ? "VIEW" : "TABLE");
        asset.setLayer(resolvedLayer);
        asset.setSpace(task.getDefaultSpace());
        asset.setOwner(task.getDefaultOwner());
        asset.setStatus("ACTIVE");
        asset.setDescription("Auto-discovered from " + schema);
        asset.setSourceType("JDBC_SCHEMA");
        asset.setIsManaged(false); // Mark as unmanaged until reviewed
        asset.setCreatedAt(LocalDateTime.now());
        asset.setUpdatedAt(LocalDateTime.now());
        
        if (existing == null) {
            assetMapper.insert(asset);
            result.incrementAssetsCreated();
        } else {
            assetMapper.updateById(asset);
            result.incrementAssetsUpdated();
        }
        
        // Collect columns
        collectColumns(conn, metaData, assetId, schema, tableName, task, result);
    }

    private void collectColumns(Connection conn, DatabaseMetaData metaData, String assetId,
                                String schema, String tableName, MetadataCollectTaskEntity task, CollectResult result) {
        try {
            // Snapshot previous columns before rebuild so structural changes can be detected
            List<AssetColumnEntity> oldColumns = assetColumnMapper.findByAssetId(assetId);

            // Clear existing columns for this asset to reflect latest structure
            assetColumnMapper.deleteByAssetId(assetId);

            // Fetch primary key columns once per table
            Set<String> primaryKeys = getPrimaryKeyColumns(metaData, schema, tableName);

            Map<String, AssetColumnEntity> newColumns = new HashMap<>();
            try (ResultSet rs = metaData.getColumns(null, schema, tableName, "%")) {
                while (rs.next()) {
                    String columnName = rs.getString("COLUMN_NAME");
                    String dataType = rs.getString("TYPE_NAME");
                    int size = rs.getInt("COLUMN_SIZE");
                    boolean nullable = rs.getInt("NULLABLE") != DatabaseMetaData.columnNoNulls;
                    String remarks = rs.getString("REMARKS");
                    String defaultValue = rs.getString("COLUMN_DEF");

                    AssetColumnEntity column = new AssetColumnEntity();
                    column.setId("col:" + schema + "." + tableName + "." + columnName);
                    column.setAssetId(assetId);
                    column.setName(columnName);
                    column.setType(size > 0 ? dataType + "(" + size + ")" : dataType);
                    column.setNullable(nullable);
                    column.setComment(remarks != null ? remarks
                            : (defaultValue != null ? "default=" + defaultValue : null));
                    column.setIsPrimary(primaryKeys.contains(columnName));
                    column.setIsPii(isPiiColumn(columnName, remarks));
                    column.setSensitivity(Boolean.TRUE.equals(column.getIsPii()) ? "秘密" : "内部");
                    column.setTransformType("DIRECT");
                    column.setLastModified(LocalDateTime.now());
                    column.setCreatedAt(LocalDateTime.now());

                    assetColumnMapper.insert(column);
                    newColumns.put(columnName, column);
                    result.incrementColumnsFound();
                }
            }

            // Detect schema drift against the previous snapshot
            detectColumnChanges(oldColumns, newColumns, schema, tableName, task, result);

            // Persist a schema version snapshot when the structure changed (time-travel supply)
            schemaVersionService.capture(assetId, newColumns.values());
            log.debug("Collected columns for asset: {}", assetId);
        } catch (Exception e) {
            log.warn("Column collection failed for {}.{}: {}", schema, tableName, e.getMessage());
        }
    }

    /**
     * Compare the previous column snapshot with the freshly collected one and emit
     * change events for drift (added / dropped / retyped columns). The first snapshot
     * (no previous columns) produces no events to avoid initial noise.
     */
    private void detectColumnChanges(List<AssetColumnEntity> oldColumns,
                                     Map<String, AssetColumnEntity> newColumns,
                                     String schema, String tableName,
                                     MetadataCollectTaskEntity task, CollectResult result) {
        if (oldColumns == null || oldColumns.isEmpty()) {
            return;
        }
        Map<String, AssetColumnEntity> oldByName = oldColumns.stream()
                .collect(Collectors.toMap(AssetColumnEntity::getName, c -> c, (a, b) -> a));
        String assetId = "asset:" + schema + "." + tableName;

        for (AssetColumnEntity oldCol : oldByName.values()) {
            if (!newColumns.containsKey(oldCol.getName())) {
                recordChange(assetId, tableName, "DROP_COLUMN", oldCol.getName(),
                        oldCol.getType(), null, true, task, result);
            }
        }
        for (AssetColumnEntity newCol : newColumns.values()) {
            AssetColumnEntity oldCol = oldByName.get(newCol.getName());
            if (oldCol == null) {
                boolean nullable = Boolean.TRUE.equals(newCol.getNullable());
                recordChange(assetId, tableName,
                        nullable ? "ADD_NULLABLE_COLUMN" : "ADD_NON_NULL_COLUMN",
                        newCol.getName(), null, newCol.getType(), !nullable, task, result);
            } else if (!Objects.equals(oldCol.getType(), newCol.getType())) {
                recordChange(assetId, tableName, "CHANGE_DATA_TYPE", newCol.getName(),
                        oldCol.getType(), newCol.getType(), true, task, result);
            }
        }
    }

    private void recordChange(String assetId, String assetName, String changeType, String column,
                              String oldValue, String newValue, boolean breaking,
                              MetadataCollectTaskEntity task, CollectResult result) {
        ChangeEventEntity event = new ChangeEventEntity();
        event.setAssetId(assetId);
        event.setAssetName(assetName);
        event.setChangeType(changeType);
        ChangeEventEntity.ChangeDetails details = new ChangeEventEntity.ChangeDetails();
        details.setColumn(column);
        details.setOldValue(oldValue);
        details.setNewValue(newValue);
        details.setRawDiff(buildRawDiff(assetId, changeType, column, oldValue, newValue));
        event.setDetails(details);
        event.setDetectedBy("PROBE");
        event.setIsBreaking(breaking);
        event.setIsManaged(false); // auto-discovery is an unmanaged "dark change"
        event.setStatus("DETECTED");
        event.setActor("JDBC Collector");
        event.setTraceId("collect:" + task.getId());
        event.setImpactVerdict(breaking ? "HIGH" : "LOW");
        event.setImpactSummary(String.format("自动采集检测到字段变更: %s (%s)", column, changeType));
        event.setAffectedMetrics(0);
        event.setAffectedReports(0);
        event.setAffectedApis(0);
        event.setAffectedTables(0);
        event.setTimestamp(LocalDateTime.now());
        event.setCreatedAt(LocalDateTime.now());
        changeEventMapper.insert(event);
        result.incrementChangesDetected();
    }

    /** Render a human-readable DDL diff so the M4 change center can display a meaningful rawDiff. */
    private String buildRawDiff(String assetId, String changeType, String column,
                                String oldValue, String newValue) {
        String qualified = assetId != null && assetId.startsWith("asset:")
                ? assetId.substring("asset:".length()) : assetId;
        switch (changeType) {
            case "DROP_COLUMN":
                return "ALTER TABLE " + qualified + " DROP COLUMN " + column + ";\n-- previous type: " + oldValue;
            case "ADD_NULLABLE_COLUMN":
            case "ADD_NON_NULL_COLUMN":
                return "ALTER TABLE " + qualified + " ADD COLUMN " + column + " " + newValue + ";";
            case "CHANGE_DATA_TYPE":
                return "ALTER TABLE " + qualified + " MODIFY COLUMN " + column + " " + newValue
                        + ";\n-- previous type: " + oldValue;
            default:
                return null;
        }
    }

    private Set<String> getPrimaryKeyColumns(DatabaseMetaData metaData, String schema, String tableName) {
        Set<String> primaryKeys = new HashSet<>();
        try (ResultSet rs = metaData.getPrimaryKeys(null, schema, tableName)) {
            while (rs.next()) {
                primaryKeys.add(rs.getString("COLUMN_NAME"));
            }
        } catch (Exception e) {
            log.debug("Primary key check failed for {}.{}: {}", schema, tableName, e.getMessage());
        }
        return primaryKeys;
    }

    /**
     * Heuristic PII detection based on column naming conventions.
     */
    private boolean isPiiColumn(String columnName, String remark) {
        String lower = columnName.toLowerCase();
        String[] piiPatterns = {"id_card", "idcard", "phone", "mobile", "email", "address",
                "name", "birth", "passport", "bank_card", "bankcard", "ssn", "salary",
                "身份证", "手机", "电话", "邮箱", "地址", "姓名", "护照", "银行卡", "工资"};
        for (String pattern : piiPatterns) {
            if (lower.contains(pattern)) {
                return true;
            }
        }
        if (remark != null) {
            String lowerRemark = remark.toLowerCase();
            for (String pattern : piiPatterns) {
                if (lowerRemark.contains(pattern)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean shouldExclude(String tableName, List<String> excludePatterns) {
        if (excludePatterns == null || excludePatterns.isEmpty()) {
            return false;
        }
        return excludePatterns.stream().anyMatch(tableName::matches);
    }

    private boolean matchesWhitelist(String tableName, List<String> whitelist) {
        if (whitelist == null || whitelist.isEmpty()) {
            return true;
        }
        return whitelist.stream().anyMatch(tableName::matches);
    }

    private String generateAssetCode(String layer, String schema, String tableName) {
        // Generate code like: ODS-CRM-CUST-4F2A
        // Hash suffix guarantees uniqueness even when table names share a common prefix
        String prefix = layer + "-";
        String cleanName = tableName.replaceAll("[^a-zA-Z0-9]", "").toUpperCase();
        String shortName = cleanName.substring(0, Math.min(cleanName.length(), 10));
        String hash = Integer.toHexString((schema + "." + tableName).hashCode()).toUpperCase();
        hash = hash.substring(Math.max(0, hash.length() - 4));
        return prefix + shortName + "-" + hash;
    }

    /**
     * Auto-discover lineage edges after asset registration:
     * 1) Foreign keys: referenced (parent) table -> referencing (child) table.
     * 2) View dependencies (MySQL): base table/view -> view, via information_schema.VIEW_TABLE_USAGE.
     * Auto-discovered edges are rebuilt on every run (delete by schema prefix, then insert)
     * so that removed constraints or dependencies disappear from the lineage graph.
     */
    private void discoverLineage(Connection conn, DatabaseMetaData metaData, DataSourceEntity ds,
                                 List<String> schemas, CollectResult result) {
        if (schemas == null || schemas.isEmpty()) {
            return;
        }
        Map<String, LineageEdgeEntity> discovered = new LinkedHashMap<>();
        Set<String> schemaSet = schemas.stream().map(String::toLowerCase).collect(Collectors.toSet());

        // 1) Foreign key edges
        for (String schema : schemas) {
            for (String table : listTables(metaData, schema)) {
                try (ResultSet rs = metaData.getImportedKeys(null, schema, table)) {
                    while (rs.next()) {
                        String pkSchema = trimToNull(rs.getString("PKTABLE_SCHEM"));
                        if (pkSchema == null) {
                            pkSchema = trimToNull(rs.getString("PKTABLE_CAT"));
                        }
                        String pkTable = rs.getString("PKTABLE_NAME");
                        if (pkSchema == null || pkTable == null) {
                            continue;
                        }
                        String fromId = "asset:" + pkSchema + "." + pkTable; // referenced parent
                        String toId = "asset:" + schema + "." + table;       // referencing child

                        LineageEdgeEntity edge = new LineageEdgeEntity();
                        edge.setFromAssetId(fromId);
                        edge.setToAssetId(toId);
                        edge.setFromColumn(rs.getString("PKCOLUMN_NAME"));
                        edge.setToColumn(rs.getString("FKCOLUMN_NAME"));
                        edge.setKind("TABLE");
                        edge.setSource("JDBC_FK");
                        edge.setConfidence(90);
                        edge.setTransformExpr("FK " + table + "." + rs.getString("FKCOLUMN_NAME")
                                + " -> " + pkTable + "." + rs.getString("PKCOLUMN_NAME"));
                        edge.setIsCriticalPath(false);
                        edge.setValidFrom(LocalDateTime.now());
                        discovered.putIfAbsent(fromId + "->" + toId + "@FK", edge);
                    }
                } catch (Exception e) {
                    log.debug("FK discovery failed for {}.{}: {}", schema, table, e.getMessage());
                }
            }
        }

        // 2) View dependency edges (MySQL exposes a dedicated metadata view)
        if ("MYSQL".equalsIgnoreCase(ds.getType())) {
            String sql = "SELECT VIEW_SCHEMA, VIEW_NAME, TABLE_SCHEMA, TABLE_NAME "
                    + "FROM information_schema.VIEW_TABLE_USAGE";
            try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
                while (rs.next()) {
                    String viewSchema = rs.getString("VIEW_SCHEMA");
                    if (viewSchema == null || !schemaSet.contains(viewSchema.toLowerCase())) {
                        continue;
                    }
                    String fromId = "asset:" + rs.getString("TABLE_SCHEMA") + "." + rs.getString("TABLE_NAME");
                    String toId = "asset:" + viewSchema + "." + rs.getString("VIEW_NAME");

                    LineageEdgeEntity edge = new LineageEdgeEntity();
                    edge.setFromAssetId(fromId);
                    edge.setToAssetId(toId);
                    edge.setKind("TABLE");
                    edge.setSource("VIEW_DEP");
                    edge.setConfidence(95);
                    edge.setIsCriticalPath(false);
                    edge.setValidFrom(LocalDateTime.now());
                    discovered.putIfAbsent(fromId + "->" + toId + "@VIEW", edge);
                }
            } catch (Exception e) {
                log.debug("View dependency discovery failed: {}", e.getMessage());
            }
        }

        // 3) Column-level lineage for views: parse VIEW_DEFINITION with the Druid SQL parser
        //    (single-level SELECT with JOINs / aggregates / expressions; wildcards skipped).
        if ("MYSQL".equalsIgnoreCase(ds.getType())) {
            String sql = "SELECT TABLE_SCHEMA, TABLE_NAME, VIEW_DEFINITION FROM information_schema.VIEWS";
            try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
                while (rs.next()) {
                    String viewSchema = rs.getString("TABLE_SCHEMA");
                    if (viewSchema == null || !schemaSet.contains(viewSchema.toLowerCase())) {
                        continue;
                    }
                    String viewName = rs.getString("TABLE_NAME");
                    String definition = rs.getString("VIEW_DEFINITION");
                    if (definition == null || definition.trim().isEmpty()) {
                        continue;
                    }
                    String toId = "asset:" + viewSchema + "." + viewName;
                    List<SqlColumnLineageParser.ColumnMapping> mappings =
                            columnLineageParser.parseView(definition, viewSchema);
                    for (SqlColumnLineageParser.ColumnMapping mapping : mappings) {
                        String fromId = "asset:" + mapping.getSourceSchema() + "." + mapping.getSourceTable();

                        LineageEdgeEntity edge = new LineageEdgeEntity();
                        edge.setFromAssetId(fromId);
                        edge.setToAssetId(toId);
                        edge.setFromColumn(mapping.getSourceColumn());
                        edge.setToColumn(mapping.getTargetColumn());
                        edge.setKind("COLUMN");
                        edge.setSource("PARSER");
                        edge.setConfidence(mapping.getConfidence());
                        edge.setTransformExpr(mapping.getTransformExpr());
                        edge.setIsCriticalPath(false);
                        edge.setValidFrom(LocalDateTime.now());
                        discovered.putIfAbsent(fromId + "->" + toId + "#"
                                + mapping.getSourceColumn() + ":" + mapping.getTargetColumn() + "@COL", edge);
                    }
                }
            } catch (Exception e) {
                log.debug("Column-level view lineage discovery failed: {}", e.getMessage());
            }
        }

        // Resolve endpoint existence once, then rebuild edges under the scanned schemas
        Map<String, Boolean> assetExists = new HashMap<>();
        for (LineageEdgeEntity edge : discovered.values()) {
            assetExists.computeIfAbsent(edge.getFromAssetId(), id -> assetMapper.selectById(id) != null);
            assetExists.computeIfAbsent(edge.getToAssetId(), id -> assetMapper.selectById(id) != null);
        }

        lineageEdgeMapper.deleteAutoDiscoveredBySchemas(schemas);
        int inserted = 0;
        for (LineageEdgeEntity edge : discovered.values()) {
            if (!Boolean.TRUE.equals(assetExists.get(edge.getFromAssetId()))
                    || !Boolean.TRUE.equals(assetExists.get(edge.getToAssetId()))) {
                continue;
            }
            lineageEdgeMapper.insert(edge);
            result.incrementEdgesDiscovered();
            inserted++;
        }
        log.info("Lineage discovery for schemas {}: {} edges inserted ({} candidates)",
                schemas, inserted, discovered.size());
    }

    private List<String> listTables(DatabaseMetaData metaData, String schema) {
        List<String> tables = new ArrayList<>();
        try (ResultSet rs = metaData.getTables(null, schema, "%", new String[]{"TABLE"})) {
            while (rs.next()) {
                String tableCat = rs.getString("TABLE_CAT");
                String tableSchem = rs.getString("TABLE_SCHEM");
                String actual = (tableSchem != null && !tableSchem.isEmpty()) ? tableSchem : tableCat;
                if (actual != null && !schema.equalsIgnoreCase(actual)) {
                    continue;
                }
                tables.add(rs.getString("TABLE_NAME"));
            }
        } catch (Exception e) {
            log.debug("Table listing failed for {}: {}", schema, e.getMessage());
        }
        return tables;
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private String buildJdbcUrl(DataSourceEntity ds) {
        switch (ds.getType().toUpperCase()) {
            case "MYSQL":
                // allowPublicKeyRetrieval=true is required by MySQL 8 caching_sha2_password over non-SSL connections
                return String.format("jdbc:mysql://%s:%d/%s?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC",
                    ds.getHost(), ds.getPort(), ds.getDatabaseName());
            case "POSTGRESQL":
                return String.format("jdbc:postgresql://%s:%d/%s",
                    ds.getHost(), ds.getPort(), ds.getDatabaseName());
            case "ORACLE":
                return String.format("jdbc:oracle:thin:@%s:%d:%s",
                    ds.getHost(), ds.getPort(), ds.getDatabaseName());
            case "SQLSERVER":
                return String.format("jdbc:sqlserver://%s:%d;databaseName=%s",
                    ds.getHost(), ds.getPort(), ds.getDatabaseName());
            case "HIVE":
                return String.format("jdbc:hive2://%s:%d/%s",
                    ds.getHost(), ds.getPort(), ds.getDatabaseName());
            case "CLICKHOUSE":
                return String.format("jdbc:clickhouse://%s:%d/%s",
                    ds.getHost(), ds.getPort(), ds.getDatabaseName());
            default:
                throw new UnsupportedOperationException("Unsupported database type: " + ds.getType());
        }
    }

    @lombok.Data
    public static class CollectResult {
        private String taskId;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private boolean success;
        private String errorMessage;
        private int schemasScanned;
        private int tablesFound;
        private int columnsFound;
        private int assetsCreated;
        private int assetsUpdated;
        private int edgesDiscovered;
        private int changesDetected;

        public void incrementTablesFound() { this.tablesFound++; }
        public void incrementColumnsFound() { this.columnsFound++; }
        public void incrementAssetsCreated() { this.assetsCreated++; }
        public void incrementAssetsUpdated() { this.assetsUpdated++; }
        public void incrementEdgesDiscovered() { this.edgesDiscovered++; }
        public void incrementChangesDetected() { this.changesDetected++; }
    }
}
