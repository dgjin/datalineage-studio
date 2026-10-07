package com.datalineage.controller;

import com.datalineage.audit.AuditLog;
import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.LineageEdgeEntity;
import com.datalineage.service.LineageRetentionService;
import com.datalineage.service.LineageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/lineage")
@RequiredArgsConstructor
@Tag(name = "血缘管理", description = "数据血缘关系查询与分析")
public class LineageController {

    private final LineageService lineageService;
    private final LineageRetentionService lineageRetentionService;

    @GetMapping("/edges")
    @Operation(summary = "获取血缘边列表")
    public ApiResponse<List<LineageEdgeEntity>> listEdges(
            @RequestParam(required = false) String assetId,
            @RequestParam(required = false) String kind) {
        List<LineageEdgeEntity> edges = lineageService.listEdges(assetId, kind);
        return ApiResponse.success(edges);
    }

    @GetMapping("/assets/{assetId}")
    @Operation(summary = "获取资产血缘")
    public ApiResponse<List<LineageEdgeEntity>> getAssetLineage(@PathVariable String assetId) {
        List<LineageEdgeEntity> lineage = lineageService.getAssetLineage(assetId);
        return ApiResponse.success(lineage);
    }

    @GetMapping("/edges/at-time")
    @Operation(summary = "时点回放：获取指定时间点有效的血缘边（bitemporal replay）")
    public ApiResponse<Map<String, Object>> edgesAtTime(@RequestParam String time) {
        List<LineageEdgeEntity> edges = lineageService.listEdgesAtTime(time);
        Map<String, Object> result = new HashMap<>();
        result.put("time", time);
        result.put("edges", edges);
        result.put("edgeCount", edges.size());
        return ApiResponse.success(result);
    }

    @PostMapping("/retention/sweep")
    @AuditLog(action = "RETENTION_SWEEP", resourceType = "LINEAGE", summary = "血缘滞留清理（超期失效+置信度衰减）")
    @Operation(summary = "手动触发血缘滞留清理（超期自动边失效+置信度衰减）")
    public ApiResponse<Map<String, Object>> retentionSweep() {
        int expired = lineageRetentionService.sweep();
        Map<String, Object> result = new HashMap<>();
        result.put("expiredEdges", expired);
        result.put("retentionDays", LineageRetentionService.RETENTION_DAYS);
        return ApiResponse.success(result, "Retention sweep completed");
    }

    @GetMapping("/graph")
    @Operation(summary = "获取血缘图谱")
    public ApiResponse<Map<String, Object>> getLineageGraph(
            @RequestParam(required = false) String space,
            @RequestParam(required = false) String layer) {
        Map<String, Object> graph = lineageService.getLineageGraph(space, layer);
        return ApiResponse.success(graph);
    }

    @GetMapping("/path")
    @Operation(summary = "查找最短路径")
    public ApiResponse<List<LineageEdgeEntity>> findShortestPath(
            @RequestParam String from,
            @RequestParam String to) {
        List<LineageEdgeEntity> path = lineageService.findShortestPath(from, to);
        return ApiResponse.success(path);
    }

    @GetMapping("/subgraph")
    @Operation(summary = "子图提取（按起点+深度+方向）")
    public ApiResponse<Map<String, Object>> getSubgraph(
            @RequestParam String rootId,
            @RequestParam(defaultValue = "2") int depth,
            @RequestParam(defaultValue = "BOTH") String direction) {
        return ApiResponse.success(lineageService.extractSubgraph(rootId, depth, direction));
    }

    @PostMapping("/edges")
    @Operation(summary = "创建血缘边")
    public ApiResponse<LineageEdgeEntity> createEdge(@RequestBody LineageEdgeEntity edge) {
        return ApiResponse.success(lineageService.createEdge(edge), "Lineage edge created");
    }

    @DeleteMapping("/edges/{id}")
    @Operation(summary = "删除血缘边")
    public ApiResponse<Void> deleteEdge(@PathVariable String id) {
        lineageService.deleteEdge(id);
        return ApiResponse.success(null, "Lineage edge deleted");
    }
}
