package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.ChangeEventEntity;
import com.datalineage.entity.ImpactAckEntity;
import com.datalineage.service.ChangeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/changes")
@RequiredArgsConstructor
@Tag(name = "变更中心", description = "变更事件管理与影响确认")
public class ChangeController {

    private final ChangeService changeService;

    @GetMapping
    @Operation(summary = "获取变更事件列表")
    public ApiResponse<List<ChangeEventEntity>> listChanges(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean isManaged,
            @RequestParam(required = false) Boolean isBreaking) {
        return ApiResponse.success(changeService.listChanges(status, isManaged, isBreaking));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取变更事件详情")
    public ApiResponse<ChangeEventEntity> getChange(@PathVariable String id) {
        return ApiResponse.success(changeService.getChange(id));
    }

    @GetMapping("/by-asset/{assetId}")
    @Operation(summary = "获取资产的变更历史")
    public ApiResponse<List<ChangeEventEntity>> getChangesByAsset(@PathVariable String assetId) {
        return ApiResponse.success(changeService.getChangesByAsset(assetId));
    }

    @PostMapping
    @Operation(summary = "上报变更事件（自动触发影响分析）")
    public ApiResponse<ChangeEventEntity> createChange(@RequestBody ChangeEventEntity change) {
        return ApiResponse.success(changeService.createChange(change), "Change recorded and analyzed");
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "更新变更事件状态")
    public ApiResponse<ChangeEventEntity> updateStatus(@PathVariable String id,
                                                        @RequestParam String status,
                                                        @RequestParam(required = false) String actor) {
        return ApiResponse.success(changeService.updateStatus(id, status, actor), "Status updated");
    }

    @PostMapping("/{id}/manage")
    @Operation(summary = "契约补录后将变更纳入受控管理")
    public ApiResponse<ChangeEventEntity> markManaged(@PathVariable String id,
                                                       @RequestParam(required = false) String actor) {
        return ApiResponse.success(changeService.markManaged(id, actor), "Change backfilled and managed");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除变更事件")
    public ApiResponse<Void> deleteChange(@PathVariable String id) {
        changeService.deleteChange(id);
        return ApiResponse.success(null, "Change deleted successfully");
    }

    @GetMapping("/{id}/acks")
    @Operation(summary = "获取变更的影响确认列表")
    public ApiResponse<List<ImpactAckEntity>> getAcks(@PathVariable String id) {
        return ApiResponse.success(changeService.getAcks(id));
    }

    @GetMapping("/stats")
    @Operation(summary = "获取变更统计")
    public ApiResponse<Map<String, Object>> getStats() {
        return ApiResponse.success(changeService.getChangeStats());
    }
}
