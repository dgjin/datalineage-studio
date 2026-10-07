package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.service.AuditLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/audit-logs")
@RequiredArgsConstructor
@Tag(name = "全链路审计", description = "写操作审计轨迹查询（用户/动作/资源/结果/耗时）")
public class AuditController {

    private final AuditLogService auditLogService;

    @GetMapping
    @Operation(summary = "分页查询审计轨迹")
    public ApiResponse<Map<String, Object>> query(
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(auditLogService.query(username, action, resourceType, result, from, to, page, size));
    }
}
