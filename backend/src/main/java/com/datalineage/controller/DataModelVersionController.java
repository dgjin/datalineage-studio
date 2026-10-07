package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.DataModelTableEntity;
import com.datalineage.service.DataModelService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/model-versions")
@RequiredArgsConstructor
@Tag(name = "数据模型版本回放", description = "按版本 ID 回放历史导入的表结构快照")
public class DataModelVersionController {

    private final DataModelService dataModelService;

    @GetMapping("/{vid}/tables")
    @Operation(summary = "回放指定版本的表结构明细（从归档原始文件重新解析）")
    public ApiResponse<List<DataModelTableEntity>> versionTables(@PathVariable String vid) {
        return ApiResponse.success(dataModelService.versionTables(vid));
    }
}
