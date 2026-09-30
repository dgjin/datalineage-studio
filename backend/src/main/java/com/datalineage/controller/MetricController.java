package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.MetricEntity;
import com.datalineage.entity.MetricHistoryEntity;
import com.datalineage.service.MetricService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/metrics")
@RequiredArgsConstructor
@Tag(name = "指标中心", description = "指标定义与版本历史管理")
public class MetricController {

    private final MetricService metricService;

    @GetMapping
    @Operation(summary = "获取指标列表")
    public ApiResponse<List<MetricEntity>> listMetrics(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String owner,
            @RequestParam(required = false) String q) {
        return ApiResponse.success(metricService.listMetrics(status, type, owner, q));
    }

    @GetMapping("/{code}")
    @Operation(summary = "获取指标详情")
    public ApiResponse<MetricEntity> getMetric(@PathVariable String code) {
        return ApiResponse.success(metricService.getMetric(code));
    }

    @PostMapping
    @Operation(summary = "创建指标")
    public ApiResponse<MetricEntity> createMetric(@RequestBody MetricEntity metric) {
        return ApiResponse.success(metricService.createMetric(metric), "Metric created successfully");
    }

    @PutMapping("/{code}")
    @Operation(summary = "更新指标")
    public ApiResponse<MetricEntity> updateMetric(@PathVariable String code,
                                                   @RequestBody MetricEntity metric) {
        return ApiResponse.success(metricService.updateMetric(code, metric), "Metric updated successfully");
    }

    @DeleteMapping("/{code}")
    @Operation(summary = "删除指标")
    public ApiResponse<Void> deleteMetric(@PathVariable String code) {
        metricService.deleteMetric(code);
        return ApiResponse.success(null, "Metric deleted successfully");
    }

    @GetMapping("/{code}/history")
    @Operation(summary = "获取指标版本历史")
    public ApiResponse<List<MetricHistoryEntity>> getMetricHistory(@PathVariable String code) {
        return ApiResponse.success(metricService.getMetricHistory(code));
    }

    @GetMapping("/by-asset/{assetId}")
    @Operation(summary = "获取引用指定资产的指标")
    public ApiResponse<List<MetricEntity>> getMetricsByAsset(@PathVariable String assetId) {
        return ApiResponse.success(metricService.getMetricsByAsset(assetId));
    }
}
