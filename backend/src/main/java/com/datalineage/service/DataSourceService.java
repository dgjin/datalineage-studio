package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.DataSourceEntity;
import com.datalineage.mapper.DataSourceMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jasypt.encryption.StringEncryptor;
import org.springframework.stereotype.Service;

import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DataSourceService {

    private final DataSourceMapper dataSourceMapper;
    private final StringEncryptor stringEncryptor;

    public List<DataSourceEntity> listDataSources() {
        return dataSourceMapper.selectList(null);
    }

    public DataSourceEntity getDataSource(String id) {
        return dataSourceMapper.selectById(id);
    }

    public DataSourceEntity createDataSource(DataSourceEntity ds) {
        // Encrypt password before saving
        if (ds.getPasswordEncrypted() != null && !ds.getPasswordEncrypted().isEmpty()) {
            ds.setPasswordEncrypted(stringEncryptor.encrypt(ds.getPasswordEncrypted()));
        }
        dataSourceMapper.insert(ds);
        return ds;
    }

    public DataSourceEntity updateDataSource(String id, DataSourceEntity ds) {
        ds.setId(id);
        if (ds.getPasswordEncrypted() != null && !ds.getPasswordEncrypted().isEmpty()) {
            ds.setPasswordEncrypted(stringEncryptor.encrypt(ds.getPasswordEncrypted()));
        }
        dataSourceMapper.updateById(ds);
        return dataSourceMapper.selectById(id);
    }

    public void deleteDataSource(String id) {
        dataSourceMapper.deleteById(id);
    }

    /**
     * Disable a data source. Its collection tasks can no longer run
     * (both manual triggers and cron schedules are blocked in the collector).
     */
    public DataSourceEntity disableDataSource(String id) {
        DataSourceEntity ds = dataSourceMapper.selectById(id);
        if (ds == null) {
            throw new RuntimeException("Data source not found: " + id);
        }
        ds.setStatus("INACTIVE");
        dataSourceMapper.updateById(ds);
        return ds;
    }

    /**
     * Re-enable a previously disabled data source.
     */
    public DataSourceEntity enableDataSource(String id) {
        DataSourceEntity ds = dataSourceMapper.selectById(id);
        if (ds == null) {
            throw new RuntimeException("Data source not found: " + id);
        }
        ds.setStatus("ACTIVE");
        dataSourceMapper.updateById(ds);
        return ds;
    }

    /**
     * Test database connection
     */
    public Map<String, Object> testConnection(String id) {
        DataSourceEntity ds = dataSourceMapper.selectById(id);
        if (ds == null) {
            throw new RuntimeException("Data source not found: " + id);
        }

        Map<String, Object> result = new HashMap<>();
        long startTime = System.currentTimeMillis();
        
        try {
            String url = buildJdbcUrl(ds);
            String password = stringEncryptor.decrypt(ds.getPasswordEncrypted());
            
            try (Connection conn = DriverManager.getConnection(url, ds.getUsername(), password)) {
                long latency = System.currentTimeMillis() - startTime;
                
                // Get database metadata
                DatabaseMetaData metaData = conn.getMetaData();
                
                result.put("success", true);
                result.put("latency", latency + "ms");
                result.put("databaseProduct", metaData.getDatabaseProductName());
                result.put("databaseVersion", metaData.getDatabaseProductVersion());
                result.put("driverName", metaData.getDriverName());
                
                // Update test result
                ds.setLastTestAt(java.time.LocalDateTime.now());
                ds.setLastTestResult("SUCCESS");
                ds.setTestErrorMsg(null);
                dataSourceMapper.updateById(ds);
            }
        } catch (Exception e) {
            log.error("Connection test failed for datasource: {}", id, e);
            result.put("success", false);
            result.put("error", e.getMessage());
            
            // Update test result
            ds.setLastTestAt(java.time.LocalDateTime.now());
            ds.setLastTestResult("FAILED");
            ds.setTestErrorMsg(e.getMessage());
            dataSourceMapper.updateById(ds);
        }
        
        return result;
    }

    /**
     * Get schemas from data source.
     * MySQL maps databases to JDBC catalogs, other engines expose real schemas.
     */
    public List<String> getSchemas(String id) throws SQLException {
        DataSourceEntity ds = dataSourceMapper.selectById(id);
        if (ds == null) {
            throw new RuntimeException("Data source not found: " + id);
        }

        List<String> schemas = new ArrayList<>();
        String url = buildJdbcUrl(ds);
        String password = stringEncryptor.decrypt(ds.getPasswordEncrypted());
        boolean mysql = "MYSQL".equalsIgnoreCase(ds.getType());

        try (Connection conn = DriverManager.getConnection(url, ds.getUsername(), password)) {
            DatabaseMetaData metaData = conn.getMetaData();
            if (mysql) {
                try (ResultSet rs = metaData.getCatalogs()) {
                    while (rs.next()) {
                        String name = rs.getString("TABLE_CAT");
                        if (name != null && !isSystemSchema(name)) {
                            schemas.add(name);
                        }
                    }
                }
            } else {
                try (ResultSet rs = metaData.getSchemas()) {
                    while (rs.next()) {
                        String name = rs.getString("TABLE_SCHEM");
                        if (name != null && !isSystemSchema(name)) {
                            schemas.add(name);
                        }
                    }
                }
            }
        }

        return schemas;
    }

    private static boolean isSystemSchema(String name) {
        String lower = name.toLowerCase();
        return "information_schema".equals(lower) || "mysql".equals(lower)
                || "performance_schema".equals(lower) || "sys".equals(lower);
    }

    /**
     * Get tables from a schema.
     * For MySQL the schema name is passed as catalog and verified per row.
     */
    public List<Map<String, Object>> getTables(String id, String schema) throws SQLException {
        DataSourceEntity ds = dataSourceMapper.selectById(id);
        if (ds == null) {
            throw new RuntimeException("Data source not found: " + id);
        }

        List<Map<String, Object>> tables = new ArrayList<>();
        String url = buildJdbcUrl(ds);
        String password = stringEncryptor.decrypt(ds.getPasswordEncrypted());
        boolean mysql = "MYSQL".equalsIgnoreCase(ds.getType());

        try (Connection conn = DriverManager.getConnection(url, ds.getUsername(), password)) {
            DatabaseMetaData metaData = conn.getMetaData();
            String catalogParam = mysql ? schema : null;
            String schemaParam = mysql ? null : schema;
            try (ResultSet rs = metaData.getTables(catalogParam, schemaParam, "%", new String[]{"TABLE", "VIEW"})) {
                while (rs.next()) {
                    String tableCat = rs.getString("TABLE_CAT");
                    String tableSchem = rs.getString("TABLE_SCHEM");
                    String actual = (tableSchem != null && !tableSchem.isEmpty()) ? tableSchem : tableCat;
                    if (schema != null && actual != null && !schema.equalsIgnoreCase(actual)) {
                        continue;
                    }
                    Map<String, Object> table = new HashMap<>();
                    table.put("name", rs.getString("TABLE_NAME"));
                    table.put("type", rs.getString("TABLE_TYPE"));
                    table.put("remarks", rs.getString("REMARKS"));
                    table.put("schema", actual);
                    tables.add(table);
                }
            }
        }

        return tables;
    }

    private String buildJdbcUrl(DataSourceEntity ds) {
        String baseUrl;
        switch (ds.getType().toUpperCase()) {
            case "MYSQL":
                // allowPublicKeyRetrieval=true is required by MySQL 8 caching_sha2_password over non-SSL connections
                baseUrl = String.format("jdbc:mysql://%s:%d/%s?useSSL=%s&allowPublicKeyRetrieval=true&serverTimezone=UTC",
                    ds.getHost(), ds.getPort(), ds.getDatabaseName(), ds.getSslEnabled());
                break;
            case "POSTGRESQL":
                baseUrl = String.format("jdbc:postgresql://%s:%d/%s",
                    ds.getHost(), ds.getPort(), ds.getDatabaseName());
                break;
            case "ORACLE":
                baseUrl = String.format("jdbc:oracle:thin:@%s:%d:%s",
                    ds.getHost(), ds.getPort(), ds.getDatabaseName());
                break;
            case "SQLSERVER":
                baseUrl = String.format("jdbc:sqlserver://%s:%d;databaseName=%s",
                    ds.getHost(), ds.getPort(), ds.getDatabaseName());
                break;
            default:
                throw new UnsupportedOperationException("Unsupported database type: " + ds.getType());
        }
        return baseUrl;
    }
}
