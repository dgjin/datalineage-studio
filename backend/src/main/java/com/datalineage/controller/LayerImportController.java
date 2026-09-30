package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.LayerImportRelationEntity;
import com.datalineage.service.LayerImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Layer Import", description = "多数据源分层导入与层间关系编排")
@RestController
@RequestMapping("/layer-imports")
@RequiredArgsConstructor
public class LayerImportController {

    private final LayerImportService layerImportService;

    @GetMapping
    @Operation(summary = "层间关系列表")
    public ApiResponse<List<Map<String, Object>>> list(
            @RequestParam(required = false) String fromLayer,
            @RequestParam(required = false) String toLayer,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(layerImportService.list(fromLayer, toLayer, status));
    }

    @GetMapping("/stats")
    @Operation(summary = "分层导入统计（层-源矩阵 + 关系 + 跨源边数）")
    public ApiResponse<Map<String, Object>> stats() {
        return ApiResponse.success(layerImportService.stats());
    }

    @GetMapping("/{id}")
    @Operation(summary = "关系详情")
    public ApiResponse<Map<String, Object>> get(@PathVariable String id) {
        return ApiResponse.success(layerImportService.get(id));
    }

    @PostMapping
    @Operation(summary = "创建层间关系")
    public ApiResponse<LayerImportRelationEntity> create(@RequestBody LayerImportRelationEntity relation) {
        return ApiResponse.success(layerImportService.create(relation), "Layer import relation created");
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新层间关系")
    public ApiResponse<Void> update(@PathVariable String id, @RequestBody LayerImportRelationEntity patch) {
        layerImportService.update(id, patch);
        return ApiResponse.success(null, "Layer import relation updated");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除关系（级联删除产出的边）")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String id) {
        int removed = layerImportService.delete(id);
        return ApiResponse.success(Map.of("edgesRemoved", removed), "Layer import relation deleted");
    }

    @PostMapping("/{id}/preview")
    @Operation(summary = "试运行：预览将建立的边（不落库）")
    public ApiResponse<Map<String, Object>> preview(@PathVariable String id) {
        return ApiResponse.success(layerImportService.preview(id));
    }

    @PostMapping("/{id}/build")
    @Operation(summary = "执行构建：幂等重建该关系的血缘边")
    public ApiResponse<Map<String, Object>> build(@PathVariable String id) {
        return ApiResponse.success(layerImportService.build(id), "Layer import relation built");
    }
}
