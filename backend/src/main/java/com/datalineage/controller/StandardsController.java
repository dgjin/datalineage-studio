package com.datalineage.controller;

import com.datalineage.audit.AuditLog;
import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.DataStandardEntity;
import com.datalineage.entity.GlossaryTermEntity;
import com.datalineage.entity.ReferenceCodeEntity;
import com.datalineage.service.StandardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/standards")
@RequiredArgsConstructor
@Tag(name = "数据标准中枢", description = "标准设计/管理/维护、术语词根、编码字典与命名校验")
public class StandardsController {

    private final StandardService standardService;

    // ---- Standards ----

    @GetMapping
    @Operation(summary = "获取数据标准列表")
    public ApiResponse<List<DataStandardEntity>> listStandards(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String domain) {
        return ApiResponse.success(standardService.listStandards(type, status, domain));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取标准详情")
    public ApiResponse<DataStandardEntity> getStandard(@PathVariable String id) {
        return ApiResponse.success(standardService.getStandard(id));
    }

    @PostMapping
    @Operation(summary = "创建数据标准")
    public ApiResponse<DataStandardEntity> createStandard(@RequestBody DataStandardEntity std) {
        return ApiResponse.success(standardService.createStandard(std), "Standard created");
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新数据标准")
    public ApiResponse<DataStandardEntity> updateStandard(@PathVariable String id,
                                                          @RequestBody DataStandardEntity std) {
        return ApiResponse.success(standardService.updateStandard(id, std), "Standard updated");
    }

    @PostMapping("/{id}/publish")
    @Operation(summary = "发布标准（校验规则可编译）")
    public ApiResponse<DataStandardEntity> publishStandard(@PathVariable String id) {
        return ApiResponse.success(standardService.publishStandard(id), "Standard published");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除数据标准")
    public ApiResponse<Void> deleteStandard(@PathVariable String id) {
        standardService.deleteStandard(id);
        return ApiResponse.success(null, "Standard deleted");
    }

    // ---- Glossary ----

    @GetMapping("/glossary")
    @Operation(summary = "获取术语/词根列表")
    public ApiResponse<List<GlossaryTermEntity>> listGlossary(
            @RequestParam(required = false) String domain,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(standardService.listGlossary(domain, category, keyword));
    }

    @PostMapping("/glossary")
    @Operation(summary = "创建术语/词根")
    public ApiResponse<GlossaryTermEntity> createGlossary(@RequestBody GlossaryTermEntity term) {
        return ApiResponse.success(standardService.createGlossary(term), "Glossary term created");
    }

    @PutMapping("/glossary/{id}")
    @Operation(summary = "更新术语/词根")
    public ApiResponse<GlossaryTermEntity> updateGlossary(@PathVariable String id,
                                                          @RequestBody GlossaryTermEntity term) {
        return ApiResponse.success(standardService.updateGlossary(id, term), "Glossary term updated");
    }

    @DeleteMapping("/glossary/{id}")
    @Operation(summary = "删除术语/词根")
    public ApiResponse<Void> deleteGlossary(@PathVariable String id) {
        standardService.deleteGlossary(id);
        return ApiResponse.success(null, "Glossary term deleted");
    }

    // ---- Reference codes ----

    @GetMapping("/codes")
    @Operation(summary = "获取编码字典（按编码集筛选）")
    public ApiResponse<List<ReferenceCodeEntity>> listCodes(@RequestParam(required = false) String codeSet) {
        return ApiResponse.success(standardService.listCodes(codeSet));
    }

    @GetMapping("/codes/sets")
    @Operation(summary = "获取编码集概览")
    public ApiResponse<List<Map<String, Object>>> listCodeSets() {
        return ApiResponse.success(standardService.listCodeSets());
    }

    @PostMapping("/codes")
    @Operation(summary = "创建编码项")
    public ApiResponse<ReferenceCodeEntity> createCode(@RequestBody ReferenceCodeEntity code) {
        return ApiResponse.success(standardService.createCode(code), "Reference code created");
    }

    @PutMapping("/codes/{id}")
    @Operation(summary = "更新编码项")
    public ApiResponse<ReferenceCodeEntity> updateCode(@PathVariable String id,
                                                       @RequestBody ReferenceCodeEntity code) {
        return ApiResponse.success(standardService.updateCode(id, code), "Reference code updated");
    }

    @DeleteMapping("/codes/{id}")
    @Operation(summary = "删除编码项")
    public ApiResponse<Void> deleteCode(@PathVariable String id) {
        standardService.deleteCode(id);
        return ApiResponse.success(null, "Reference code deleted");
    }

    // ---- Naming checks ----

    @PostMapping("/naming-check")
    @AuditLog(action = "NAMING_CHECK", resourceType = "STANDARD", summary = "全量命名落标校验")
    @Operation(summary = "对全部资产执行命名规范校验（命中自动生成质量问题）")
    public ApiResponse<Map<String, Object>> executeNamingCheck() {
        return ApiResponse.success(standardService.executeNamingCheck(), "Naming check executed");
    }
}
