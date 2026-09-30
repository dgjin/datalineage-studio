package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.AssetColumnEntity;
import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.AssetSchemaVersionEntity;
import com.datalineage.entity.LineageEdgeEntity;
import com.datalineage.service.AssetService;
import com.datalineage.service.ImpactAnalysisService;
import com.datalineage.service.LineageService;
import com.datalineage.service.SchemaVersionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/assets")
@RequiredArgsConstructor
@Tag(name = "资产管理", description = "数据资产的增删改查")
public class AssetController {

    private final AssetService assetService;
    private final LineageService lineageService;
    private final ImpactAnalysisService impactAnalysisService;
    private final SchemaVersionService schemaVersionService;

    @GetMapping
    @Operation(summary = "获取资产列表")
    public ApiResponse<List<AssetEntity>> listAssets(
            @RequestParam(required = false) String space,
            @RequestParam(required = false) String layer,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status) {
        List<AssetEntity> assets = assetService.listAssets(space, layer, type, status);
        return ApiResponse.success(assets);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取资产详情")
    public ApiResponse<AssetEntity> getAsset(@PathVariable String id) {
        AssetEntity asset = assetService.getAssetById(id);
        if (asset == null) {
            return ApiResponse.error(404, "Asset not found");
        }
        return ApiResponse.success(asset);
    }

    @PostMapping
    @Operation(summary = "创建资产")
    public ApiResponse<AssetEntity> createAsset(@RequestBody AssetEntity asset) {
        AssetEntity created = assetService.createAsset(asset);
        return ApiResponse.success(created, "Asset created successfully");
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新资产")
    public ApiResponse<AssetEntity> updateAsset(@PathVariable String id, @RequestBody AssetEntity asset) {
        AssetEntity updated = assetService.updateAsset(id, asset);
        return ApiResponse.success(updated, "Asset updated successfully");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除资产")
    public ApiResponse<Void> deleteAsset(@PathVariable String id) {
        assetService.deleteAsset(id);
        return ApiResponse.success(null, "Asset deleted successfully");
    }

    @GetMapping("/search")
    @Operation(summary = "搜索资产")
    public ApiResponse<List<AssetEntity>> searchAssets(@RequestParam String q) {
        List<AssetEntity> assets = assetService.searchAssets(q);
        return ApiResponse.success(assets);
    }

    @GetMapping("/{id}/columns")
    @Operation(summary = "获取资产字段列表")
    public ApiResponse<List<AssetColumnEntity>> getAssetColumns(@PathVariable String id) {
        return ApiResponse.success(assetService.getAssetColumns(id));
    }

    @GetMapping("/{id}/schema-versions")
    @Operation(summary = "获取资产结构版本列表（时间旅行）")
    public ApiResponse<List<AssetSchemaVersionEntity>> listSchemaVersions(@PathVariable String id) {
        return ApiResponse.success(schemaVersionService.listVersions(id));
    }

    @GetMapping("/{id}/schema-versions/{version}")
    @Operation(summary = "获取指定版本的结构快照")
    public ApiResponse<AssetSchemaVersionEntity> getSchemaVersion(@PathVariable String id,
                                                                  @PathVariable int version) {
        AssetSchemaVersionEntity entity = schemaVersionService.getVersion(id, version);
        if (entity == null) {
            return ApiResponse.error(404, "Schema version not found");
        }
        return ApiResponse.success(entity);
    }

    @GetMapping("/{id}/lineage")
    @Operation(summary = "获取资产血缘（上游+下游）")
    public ApiResponse<Map<String, Object>> getAssetLineage(@PathVariable String id) {
        List<LineageEdgeEntity> edges = lineageService.getAssetLineage(id);
        List<LineageEdgeEntity> upstream = new ArrayList<>();
        List<LineageEdgeEntity> downstream = new ArrayList<>();
        for (LineageEdgeEntity edge : edges) {
            if (id.equals(edge.getToAssetId())) {
                upstream.add(edge);
            }
            if (id.equals(edge.getFromAssetId())) {
                downstream.add(edge);
            }
        }
        Map<String, Object> result = new HashMap<>();
        result.put("assetId", id);
        result.put("upstream", upstream);
        result.put("downstream", downstream);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}/impact")
    @Operation(summary = "资产影响分析（下游爆炸半径）")
    public ApiResponse<Map<String, Object>> getAssetImpact(@PathVariable String id) {
        return ApiResponse.success(impactAnalysisService.analyzeImpact(id));
    }
}
