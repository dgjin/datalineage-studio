package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.ApprovalRecordEntity;
import com.datalineage.entity.ChangeEventEntity;
import com.datalineage.service.ApprovalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/approvals")
@RequiredArgsConstructor
@Tag(name = "发布审批", description = "高风险变更的发布门禁审批流")
public class ApprovalController {

    private final ApprovalService approvalService;

    @GetMapping("/pending")
    @Operation(summary = "待审批变更列表")
    public ApiResponse<List<ChangeEventEntity>> listPending() {
        return ApiResponse.success(approvalService.listPending());
    }

    @GetMapping("/records/{changeId}")
    @Operation(summary = "变更的审批流水")
    public ApiResponse<List<ApprovalRecordEntity>> getRecords(@PathVariable String changeId) {
        return ApiResponse.success(approvalService.getRecords(changeId));
    }

    @GetMapping("/decisions")
    @Operation(summary = "最近审批决策（含变更详情）")
    public ApiResponse<List<Map<String, Object>>> listRecentDecisions(
            @RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.success(approvalService.listRecentDecisions(limit));
    }

    @PostMapping("/{changeId}/submit")
    @Operation(summary = "提交审批")
    public ApiResponse<ChangeEventEntity> submit(@PathVariable String changeId,
                                                 @RequestBody(required = false) Map<String, String> body) {
        String actor = body != null ? body.get("actor") : null;
        String comment = body != null ? body.get("comment") : null;
        return ApiResponse.success(approvalService.submitForApproval(changeId, actor, comment), "Submitted");
    }

    @PostMapping("/{changeId}/approve")
    @Operation(summary = "批准发布")
    public ApiResponse<ChangeEventEntity> approve(@PathVariable String changeId,
                                                  @RequestBody(required = false) Map<String, String> body) {
        String actor = body != null ? body.get("actor") : null;
        String comment = body != null ? body.get("comment") : null;
        return ApiResponse.success(approvalService.approve(changeId, actor, comment), "Approved");
    }

    @PostMapping("/{changeId}/reject")
    @Operation(summary = "驳回变更")
    public ApiResponse<ChangeEventEntity> reject(@PathVariable String changeId,
                                                 @RequestBody(required = false) Map<String, String> body) {
        String actor = body != null ? body.get("actor") : null;
        String comment = body != null ? body.get("comment") : null;
        return ApiResponse.success(approvalService.reject(changeId, actor, comment), "Rejected");
    }
}
