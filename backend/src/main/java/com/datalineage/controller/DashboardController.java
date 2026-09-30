package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
@Tag(name = "治理驾驶舱", description = "底盘聚合统计与资产健康分")
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/overview")
    @Operation(summary = "获取治理全景聚合数据")
    public ApiResponse<Map<String, Object>> getOverview() {
        return ApiResponse.success(dashboardService.getOverview());
    }

    @GetMapping("/asset-health")
    @Operation(summary = "获取全部资产健康分")
    public ApiResponse<List<Map<String, Object>>> listAssetHealth() {
        return ApiResponse.success(dashboardService.listAssetHealth());
    }

    @GetMapping("/asset-health/{assetId}")
    @Operation(summary = "获取单个资产健康分")
    public ApiResponse<Map<String, Object>> getAssetHealth(@PathVariable String assetId) {
        return ApiResponse.success(dashboardService.getAssetHealth(assetId));
    }
}
