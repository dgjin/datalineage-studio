package com.datalineage.controller;

import com.datalineage.audit.AuditLog;
import com.datalineage.dto.ApiResponse;
import com.datalineage.dto.FeedbackEntryView;
import com.datalineage.dto.FeedbackReviewRequest;
import com.datalineage.dto.FeedbackSubmitRequest;
import com.datalineage.exception.BusinessException;
import com.datalineage.service.FeedbackService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 需求收集与反馈（移植自「智能问数据分析系统」的需求反馈功能，语义 1:1）：
 * 用户提交需求/建议/缺陷 → 管理员评估分析（纳入基线 / 不予采纳 / 退回待评估）→
 * 已纳入基线的条目经标准导出接口提供给「AIOps 自动运维智能体」做主动需求分析（契约 v1.0）。
 * 权限：提交与「我的」视图对全部登录用户开放；管理视图/评估/删除仅 ADMIN；
 * 导出接口支持服务令牌与 ADMIN JWT 双通道（见 OpsTokenAuthFilter）。
 * 网关标准路径 /api/requirements/export 由边缘（Vite dev 代理 / nginx）映射到
 * 后端 /api/v1/requirements/export。
 */
@RestController
@RequestMapping("/requirements")
@RequiredArgsConstructor
@Tag(name = "需求反馈", description = "需求收集 / 评估基线 / 标准导出（AIOps 契约 v1.0）")
public class FeedbackController {

    private final FeedbackService feedbackService;

    // ---------- 用户侧（登录即可） ----------

    @PostMapping
    @AuditLog(action = "FEEDBACK_SUBMIT", resourceType = "FEEDBACK", summary = "提交需求反馈")
    @Operation(summary = "提交需求 / 建议 / 缺陷（登录用户均可）")
    public ApiResponse<Map<String, Object>> submit(@RequestBody FeedbackSubmitRequest request,
                                                   Authentication authentication) {
        return ApiResponse.success(feedbackService.submit(authentication.getName(), request), "提交成功");
    }

    @GetMapping("/mine")
    @Operation(summary = "我的提交列表（按提交时间倒序，至多 100 条）")
    public ApiResponse<List<FeedbackEntryView>> mine(Authentication authentication) {
        return ApiResponse.success(feedbackService.listMine(authentication.getName()));
    }

    @GetMapping("/ops-progress")
    @Operation(summary = "查询条目在智能运维的处理进度（非 ADMIN 仅限本人提交的条目）")
    public ApiResponse<Map<String, Object>> opsProgress(@RequestParam(required = false) String ids,
                                                        Authentication authentication) {
        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
        return ApiResponse.success(feedbackService.opsProgress(authentication.getName(), isAdmin, ids));
    }

    // ---------- 管理侧（ADMIN） ----------

    @GetMapping
    @Operation(summary = "全部提交（待评估优先排序；?status=&kind= 过滤，非法值忽略）")
    public ApiResponse<List<FeedbackEntryView>> list(@RequestParam(required = false) String status,
                                                     @RequestParam(required = false) String kind) {
        return ApiResponse.success(feedbackService.listAdmin(status, kind));
    }

    @GetMapping("/summary")
    @Operation(summary = "统计摘要（按状态 / 类型 / 基线优先级分组计数）")
    public ApiResponse<Map<String, Object>> summary() {
        return ApiResponse.success(feedbackService.summary());
    }

    @PostMapping("/{id}/review")
    @AuditLog(action = "FEEDBACK_REVIEW", resourceType = "FEEDBACK", summary = "需求反馈评估分析")
    @Operation(summary = "评估分析：BASELINE 纳入基线 / REJECT 不予采纳 / PENDING 退回待评估")
    public ApiResponse<Map<String, Object>> review(@PathVariable Long id,
                                                   @RequestBody FeedbackReviewRequest request,
                                                   Authentication authentication) {
        return ApiResponse.success(feedbackService.review(id, request, authentication.getName()), "评估已记录");
    }

    @DeleteMapping("/{id}")
    @AuditLog(action = "FEEDBACK_DELETE", resourceType = "FEEDBACK", summary = "删除需求反馈条目")
    @Operation(summary = "删除条目（评估历史随外键级联删除）")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        feedbackService.delete(id);
        return ApiResponse.success(null, "条目已删除");
    }

    // ---------- 标准导出接口（AIOps 契约 v1.0；响应无 ApiResponse 包裹） ----------

    @GetMapping("/export")
    @Operation(summary = "导出需求基线（契约 v1.0：服务令牌 / ADMIN JWT 双通道）")
    public ResponseEntity<Object> export(@RequestParam(required = false) String status,
                                         @RequestParam(required = false) String kind,
                                         @RequestParam(required = false) String since,
                                         @RequestParam(required = false) String limit) {
        try {
            return ResponseEntity.ok(feedbackService.export(status, kind, since, limit));
        } catch (BusinessException e) {
            // 契约错误体为 {error: 中文说明}，不经全局 ApiResponse 包裹
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
