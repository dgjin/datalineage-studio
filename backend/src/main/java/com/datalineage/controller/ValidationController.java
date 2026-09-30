package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.QualityIssueEntity;
import com.datalineage.entity.ValidationRuleEntity;
import com.datalineage.service.ValidationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/validation")
@RequiredArgsConstructor
@Tag(name = "校验中心", description = "校验规则与质量问题管理")
public class ValidationController {

    private final ValidationService validationService;

    // ---- Rules ----

    @GetMapping("/rules")
    @Operation(summary = "获取校验规则列表")
    public ApiResponse<List<ValidationRuleEntity>> listRules(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Boolean enabled) {
        return ApiResponse.success(validationService.listRules(category, enabled));
    }

    @GetMapping("/rules/{id}")
    @Operation(summary = "获取校验规则详情")
    public ApiResponse<ValidationRuleEntity> getRule(@PathVariable String id) {
        return ApiResponse.success(validationService.getRule(id));
    }

    @PostMapping("/rules")
    @Operation(summary = "创建校验规则")
    public ApiResponse<ValidationRuleEntity> createRule(@RequestBody ValidationRuleEntity rule) {
        return ApiResponse.success(validationService.createRule(rule), "Rule created successfully");
    }

    @PutMapping("/rules/{id}")
    @Operation(summary = "更新校验规则")
    public ApiResponse<ValidationRuleEntity> updateRule(@PathVariable String id,
                                                         @RequestBody ValidationRuleEntity rule) {
        return ApiResponse.success(validationService.updateRule(id, rule), "Rule updated successfully");
    }

    @DeleteMapping("/rules/{id}")
    @Operation(summary = "删除校验规则")
    public ApiResponse<Void> deleteRule(@PathVariable String id) {
        validationService.deleteRule(id);
        return ApiResponse.success(null, "Rule deleted successfully");
    }

    @PostMapping("/rules/{id}/toggle")
    @Operation(summary = "启用/禁用校验规则")
    public ApiResponse<ValidationRuleEntity> toggleRule(@PathVariable String id) {
        return ApiResponse.success(validationService.toggleRule(id), "Rule toggled");
    }

    @PostMapping("/execute/{assetId}")
    @Operation(summary = "对资产执行校验")
    public ApiResponse<Map<String, Object>> executeValidation(@PathVariable String assetId) {
        return ApiResponse.success(validationService.executeValidation(assetId));
    }

    // ---- Quality Issues ----

    @GetMapping("/issues")
    @Operation(summary = "获取质量问题列表")
    public ApiResponse<List<QualityIssueEntity>> listQualityIssues(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority) {
        return ApiResponse.success(validationService.listQualityIssues(status, priority));
    }

    @PostMapping("/issues")
    @Operation(summary = "创建质量问题")
    public ApiResponse<QualityIssueEntity> createQualityIssue(@RequestBody QualityIssueEntity issue) {
        return ApiResponse.success(validationService.createQualityIssue(issue), "Quality issue created");
    }

    @PutMapping("/issues/{id}")
    @Operation(summary = "更新质量问题")
    public ApiResponse<QualityIssueEntity> updateQualityIssue(@PathVariable String id,
                                                               @RequestBody QualityIssueEntity issue) {
        return ApiResponse.success(validationService.updateQualityIssue(id, issue), "Quality issue updated");
    }

    @DeleteMapping("/issues/{id}")
    @Operation(summary = "删除质量问题")
    public ApiResponse<Void> deleteQualityIssue(@PathVariable String id) {
        validationService.deleteQualityIssue(id);
        return ApiResponse.success(null, "Quality issue deleted successfully");
    }
}
