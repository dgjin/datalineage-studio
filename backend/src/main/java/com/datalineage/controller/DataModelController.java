package com.datalineage.controller;

import com.datalineage.audit.AuditLog;
import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.DataModelEntity;
import com.datalineage.entity.DataModelTableEntity;
import com.datalineage.entity.DataModelVersionEntity;
import com.datalineage.service.DataModelService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/models")
@RequiredArgsConstructor
@Tag(name = "数据模型前置管理", description = "ERMaster/PowerDesigner 设计模型导入、版本管理、与实际库对比、影响评估")
public class DataModelController {

    private final DataModelService dataModelService;

    @PostMapping("/import")
    @AuditLog(action = "MODEL_IMPORT", resourceType = "MODEL", summary = "导入数据模型文件")
    @Operation(summary = "导入模型文件（支持 ERMaster .erm / PowerDesigner .pdm，同名重复导入自动升版）")
    public ApiResponse<DataModelEntity> importModel(
            @RequestParam("file") MultipartFile file,
            @RequestParam("name") String name,
            @RequestParam(value = "targetLayer", defaultValue = "ODS") String targetLayer,
            @RequestParam(value = "targetDataSourceId", required = false) String targetDataSourceId,
            @RequestParam(value = "createdBy", required = false) String createdBy) {
        try {
            String xmlContent = new String(file.getBytes(), StandardCharsets.UTF_8);
            DataModelEntity model = dataModelService.importModel(
                    name, file.getOriginalFilename(), xmlContent, targetLayer, targetDataSourceId, createdBy);
            return ApiResponse.success(model, "Model imported successfully");
        } catch (IOException e) {
            return ApiResponse.error(500, "Failed to read uploaded file: " + e.getMessage());
        }
    }

    @GetMapping
    @Operation(summary = "获取数据模型列表")
    public ApiResponse<List<DataModelEntity>> listModels() {
        return ApiResponse.success(dataModelService.listModels());
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取数据模型详情")
    public ApiResponse<DataModelEntity> getModel(@PathVariable String id) {
        DataModelEntity model = dataModelService.getModel(id);
        if (model == null) {
            return ApiResponse.error(404, "Data model not found");
        }
        return ApiResponse.success(model);
    }

    @GetMapping("/{id}/tables")
    @Operation(summary = "获取模型表结构明细")
    public ApiResponse<List<DataModelTableEntity>> listModelTables(@PathVariable String id) {
        return ApiResponse.success(dataModelService.listModelTables(id));
    }

    @GetMapping("/{id}/diff")
    @Operation(summary = "模型与实际 ODS 库对比（含自动影响评估）")
    public ApiResponse<Map<String, Object>> compareWithDataSource(@PathVariable String id) {
        Map<String, Object> report = dataModelService.compareWithDataSource(id);
        return ApiResponse.success(report);
    }

    @GetMapping("/{id}/versions")
    @Operation(summary = "获取模型版本历史（不含原始文件内容）")
    public ApiResponse<List<DataModelVersionEntity>> listVersions(@PathVariable String id) {
        return ApiResponse.success(dataModelService.listVersions(id));
    }

    @GetMapping("/{id}/versions/diff")
    @Operation(summary = "模型版本结构对比（from/to 为版本号，缺省为上一版到最新版）")
    public ApiResponse<Map<String, Object>> diffVersions(
            @PathVariable String id,
            @RequestParam(required = false) Integer from,
            @RequestParam(required = false) Integer to) {
        return ApiResponse.success(dataModelService.diffVersions(id, from, to));
    }

    @GetMapping("/{id}/compare/export")
    @Operation(summary = "导出模型版本对比报告（markdown / csv）")
    public ResponseEntity<byte[]> exportCompareReport(
            @PathVariable String id,
            @RequestParam(required = false) Integer from,
            @RequestParam(required = false) Integer to,
            @RequestParam(value = "format", defaultValue = "markdown") String format) {
        Map<String, Object> payload = dataModelService.exportCompareReport(id, from, to, format);
        byte[] content = (byte[]) payload.get("content");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + payload.get("fileName") + "\"")
                .contentType(MediaType.parseMediaType(String.valueOf(payload.get("contentType"))))
                .contentLength(content.length)
                .body(content);
    }
}
