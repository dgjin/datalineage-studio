package com.datalineage.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.audit.AuditLog;
import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.WebhookConfigEntity;
import com.datalineage.mapper.WebhookConfigMapper;
import com.datalineage.service.WebhookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/webhooks")
@RequiredArgsConstructor
@Tag(name = "变更 Webhook", description = "外部 CI/CD 订阅变更事件的 Webhook 配置与测试发送")
public class WebhookController {

    private static final String SECRET_MASK = "******";

    private final WebhookService webhookService;
    private final WebhookConfigMapper webhookConfigMapper;

    @GetMapping
    @Operation(summary = "Webhook 配置列表（secret 脱敏）")
    public ApiResponse<List<WebhookConfigEntity>> list() {
        List<WebhookConfigEntity> configs = webhookConfigMapper.selectList(
                new QueryWrapper<WebhookConfigEntity>().orderByDesc("created_at"));
        configs.forEach(c -> {
            if (c.getSecret() != null && !c.getSecret().isBlank()) {
                c.setSecret(SECRET_MASK);
            }
        });
        return ApiResponse.success(configs);
    }

    @PostMapping
    @AuditLog(action = "WEBHOOK_CREATE", resourceType = "WEBHOOK", summary = "创建 Webhook 订阅")
    @Operation(summary = "创建 Webhook 订阅")
    public ApiResponse<WebhookConfigEntity> create(@RequestBody WebhookConfigEntity config) {
        return ApiResponse.success(webhookService.create(config), "Webhook created");
    }

    @PutMapping("/{id}")
    @AuditLog(action = "WEBHOOK_UPDATE", resourceType = "WEBHOOK", summary = "更新 Webhook 订阅")
    @Operation(summary = "更新 Webhook 订阅（secret 回传 ****** 表示保持不变）")
    public ApiResponse<WebhookConfigEntity> update(@PathVariable String id,
                                                   @RequestBody WebhookConfigEntity patch) {
        return ApiResponse.success(webhookService.update(id, patch), "Webhook updated");
    }

    @DeleteMapping("/{id}")
    @AuditLog(action = "WEBHOOK_DELETE", resourceType = "WEBHOOK", summary = "删除 Webhook 订阅")
    @Operation(summary = "删除 Webhook 订阅")
    public ApiResponse<Void> delete(@PathVariable String id) {
        webhookService.delete(id);
        return ApiResponse.success(null, "Webhook deleted");
    }

    @PostMapping("/{id}/test")
    @AuditLog(action = "WEBHOOK_TEST", resourceType = "WEBHOOK", summary = "Webhook 测试发送")
    @Operation(summary = "向订阅地址同步发送一条 test 事件（返回投递结果）")
    public ApiResponse<Map<String, Object>> test(@PathVariable String id) {
        WebhookConfigEntity config = webhookConfigMapper.selectById(id);
        if (config == null) {
            return ApiResponse.error("Webhook not found: " + id);
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "test");
        payload.put("message", "DataLineage Studio webhook test delivery");
        payload.put("timestamp", java.time.LocalDateTime.now().toString());
        return ApiResponse.success(webhookService.deliver(config, "test", payload), "Test delivery attempted");
    }
}
