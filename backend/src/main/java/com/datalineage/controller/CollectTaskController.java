package com.datalineage.controller;

import com.datalineage.audit.AuditLog;
import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.CollectorRunLogEntity;
import com.datalineage.entity.MetadataCollectTaskEntity;
import com.datalineage.service.CollectorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/collect-tasks")
@RequiredArgsConstructor
@Tag(name = "采集任务", description = "元数据采集任务管理与触发")
public class CollectTaskController {

    private final CollectorService collectorService;

    @GetMapping
    @Operation(summary = "获取采集任务列表")
    public ApiResponse<List<MetadataCollectTaskEntity>> listTasks(
            @RequestParam(required = false) String dataSourceId,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(collectorService.listTasks(dataSourceId, status));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取采集任务详情")
    public ApiResponse<MetadataCollectTaskEntity> getTask(@PathVariable String id) {
        return ApiResponse.success(collectorService.getTask(id));
    }

    @PostMapping
    @Operation(summary = "创建采集任务")
    public ApiResponse<MetadataCollectTaskEntity> createTask(@RequestBody MetadataCollectTaskEntity task) {
        return ApiResponse.success(collectorService.createTask(task), "Collect task created");
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新采集任务")
    public ApiResponse<MetadataCollectTaskEntity> updateTask(@PathVariable String id,
                                                              @RequestBody MetadataCollectTaskEntity task) {
        return ApiResponse.success(collectorService.updateTask(id, task), "Collect task updated");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除采集任务")
    public ApiResponse<Void> deleteTask(@PathVariable String id) {
        collectorService.deleteTask(id);
        return ApiResponse.success(null, "Collect task deleted successfully");
    }

    @PostMapping("/{id}/run")
    @AuditLog(action = "COLLECT_RUN", resourceType = "COLLECT_TASK", summary = "手动触发元数据采集")
    @Operation(summary = "手动触发采集（异步，立即返回）")
    public ApiResponse<Map<String, Object>> runTask(@PathVariable String id) {
        return ApiResponse.success(collectorService.runTask(id), "Collection started");
    }

    @GetMapping("/{id}/run-status")
    @Operation(summary = "获取采集运行状态（供前端轮询进度）")
    public ApiResponse<Map<String, Object>> getRunStatus(@PathVariable String id) {
        return ApiResponse.success(collectorService.getRunStatus(id));
    }

    @PostMapping("/{id}/pause")
    @Operation(summary = "暂停采集任务")
    public ApiResponse<MetadataCollectTaskEntity> pauseTask(@PathVariable String id) {
        return ApiResponse.success(collectorService.pauseTask(id), "Collect task paused");
    }

    @PostMapping("/{id}/resume")
    @Operation(summary = "恢复采集任务")
    public ApiResponse<MetadataCollectTaskEntity> resumeTask(@PathVariable String id) {
        return ApiResponse.success(collectorService.resumeTask(id), "Collect task resumed");
    }

    @GetMapping("/{id}/logs")
    @Operation(summary = "获取采集日志")
    public ApiResponse<List<CollectorRunLogEntity>> getTaskLogs(
            @PathVariable String id,
            @RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.success(collectorService.getTaskLogs(id, limit));
    }

    @GetMapping("/logs/by-datasource/{dataSourceId}")
    @Operation(summary = "获取数据源的采集日志")
    public ApiResponse<List<CollectorRunLogEntity>> getDataSourceLogs(
            @PathVariable String dataSourceId,
            @RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.success(collectorService.getDataSourceLogs(dataSourceId, limit));
    }
}
