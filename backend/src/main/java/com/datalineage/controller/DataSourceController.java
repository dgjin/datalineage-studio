package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.DataSourceEntity;
import com.datalineage.service.DataSourceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.sql.SQLException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/datasources")
@RequiredArgsConstructor
@Tag(name = "数据源管理", description = "外部数据源配置与连接管理")
public class DataSourceController {

    private final DataSourceService dataSourceService;

    @GetMapping
    @Operation(summary = "获取数据源列表")
    public ApiResponse<List<DataSourceEntity>> listDataSources() {
        List<DataSourceEntity> dataSources = dataSourceService.listDataSources();
        return ApiResponse.success(dataSources);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取数据源详情")
    public ApiResponse<DataSourceEntity> getDataSource(@PathVariable String id) {
        DataSourceEntity ds = dataSourceService.getDataSource(id);
        if (ds == null) {
            return ApiResponse.error(404, "Data source not found");
        }
        return ApiResponse.success(ds);
    }

    @PostMapping
    @Operation(summary = "创建数据源")
    public ApiResponse<DataSourceEntity> createDataSource(@RequestBody DataSourceEntity ds) {
        DataSourceEntity created = dataSourceService.createDataSource(ds);
        return ApiResponse.success(created, "Data source created successfully");
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新数据源")
    public ApiResponse<DataSourceEntity> updateDataSource(@PathVariable String id, @RequestBody DataSourceEntity ds) {
        DataSourceEntity updated = dataSourceService.updateDataSource(id, ds);
        return ApiResponse.success(updated, "Data source updated successfully");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除数据源")
    public ApiResponse<Void> deleteDataSource(@PathVariable String id) {
        dataSourceService.deleteDataSource(id);
        return ApiResponse.success(null, "Data source deleted successfully");
    }

    @PostMapping("/{id}/disable")
    @Operation(summary = "停用数据源")
    public ApiResponse<DataSourceEntity> disableDataSource(@PathVariable String id) {
        DataSourceEntity ds = dataSourceService.disableDataSource(id);
        return ApiResponse.success(ds, "Data source disabled successfully");
    }

    @PostMapping("/{id}/enable")
    @Operation(summary = "启用数据源")
    public ApiResponse<DataSourceEntity> enableDataSource(@PathVariable String id) {
        DataSourceEntity ds = dataSourceService.enableDataSource(id);
        return ApiResponse.success(ds, "Data source enabled successfully");
    }

    @PostMapping("/{id}/test")
    @Operation(summary = "测试数据源连接")
    public ApiResponse<Map<String, Object>> testConnection(@PathVariable String id) {
        Map<String, Object> result = dataSourceService.testConnection(id);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}/schemas")
    @Operation(summary = "获取数据源 Schema 列表")
    public ApiResponse<List<String>> getSchemas(@PathVariable String id) {
        try {
            List<String> schemas = dataSourceService.getSchemas(id);
            return ApiResponse.success(schemas);
        } catch (SQLException e) {
            return ApiResponse.error(500, "Failed to fetch schemas: " + e.getMessage());
        }
    }

    @GetMapping("/{id}/tables")
    @Operation(summary = "获取数据源表列表")
    public ApiResponse<List<Map<String, Object>>> getTables(
            @PathVariable String id,
            @RequestParam(required = false) String schema) {
        try {
            List<Map<String, Object>> tables = dataSourceService.getTables(id, schema);
            return ApiResponse.success(tables);
        } catch (SQLException e) {
            return ApiResponse.error(500, "Failed to fetch tables: " + e.getMessage());
        }
    }
}
