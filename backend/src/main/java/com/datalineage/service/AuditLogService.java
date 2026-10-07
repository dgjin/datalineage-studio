package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.datalineage.entity.AuditLogEntity;
import com.datalineage.mapper.AuditLogMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Persists and queries the audit trail. Persistence failures are logged and swallowed:
 * auditing must never break the business call it observes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogMapper auditLogMapper;

    /** Best-effort insert; never throws. */
    public void record(AuditLogEntity entry) {
        try {
            auditLogMapper.insert(entry);
        } catch (Exception e) {
            log.warn("Audit insert failed for {} {}: {}", entry.getHttpMethod(), entry.getPath(), e.getMessage());
        }
    }

    /** Paged, filtered query backing the M9 audit-trail drawer. */
    public Map<String, Object> query(String username, String action, String resourceType,
                                     String result, LocalDateTime from, LocalDateTime to,
                                     int page, int size) {
        QueryWrapper<AuditLogEntity> wrapper = new QueryWrapper<>();
        if (username != null && !username.isBlank()) {
            wrapper.like("username", username.trim());
        }
        if (action != null && !action.isBlank()) {
            wrapper.eq("action", action.trim().toUpperCase());
        }
        if (resourceType != null && !resourceType.isBlank()) {
            wrapper.eq("resource_type", resourceType.trim().toUpperCase());
        }
        if (result != null && !result.isBlank()) {
            wrapper.eq("result", result.trim().toUpperCase());
        }
        if (from != null) {
            wrapper.ge("created_at", from);
        }
        if (to != null) {
            wrapper.le("created_at", to);
        }
        wrapper.orderByDesc("created_at");

        int safePage = Math.max(1, page);
        int safeSize = Math.min(100, Math.max(1, size));
        IPage<AuditLogEntity> result_page = auditLogMapper.selectPage(new Page<>(safePage, safeSize), wrapper);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", result_page.getTotal());
        out.put("page", safePage);
        out.put("size", safeSize);
        out.put("records", result_page.getRecords());
        return out;
    }
}
