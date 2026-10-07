package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.WebhookConfigEntity;
import com.datalineage.mapper.WebhookConfigMapper;
import com.datalineage.metrics.GovernanceMetrics;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Outbound change webhooks for CI/CD integration: change events, approval decisions and
 * standard violations are pushed as signed JSON to every enabled subscriber.
 *
 * Delivery is asynchronous on a small dedicated pool (HTTP timeout 5s), so a slow or dead
 * endpoint can never block the governance transaction. Every attempt is counted in
 * datalineage.webhook.deliveries.total{result,event}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebhookService {

    public static final String EVENT_CHANGE_CREATED = "change.created";
    public static final String EVENT_APPROVAL_DECIDED = "approval.decided";
    public static final String EVENT_STANDARD_VIOLATION = "standard.violation";

    private static final int TIMEOUT_SECONDS = 5;

    private final WebhookConfigMapper webhookConfigMapper;
    private final GovernanceMetrics governanceMetrics;
    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(TIMEOUT_SECONDS))
            .build();

    private final ExecutorService deliveryExecutor = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "webhook-delivery");
        t.setDaemon(true);
        return t;
    });

    /** Fan out an event to all enabled subscribers (async, fire-and-forget). */
    public void publish(String event, Map<String, Object> payload) {
        List<WebhookConfigEntity> configs;
        try {
            configs = webhookConfigMapper.selectList(
                    new QueryWrapper<WebhookConfigEntity>().eq("enabled", true));
        } catch (Exception e) {
            log.warn("Webhook fan-out skipped, config query failed: {}", e.getMessage());
            return;
        }
        for (WebhookConfigEntity config : configs) {
            if (!subscribes(config, event)) {
                continue;
            }
            deliveryExecutor.execute(() -> deliver(config, event, payload));
        }
    }

    /** Synchronous single delivery; backs both the async fan-out and the /test endpoint. */
    public Map<String, Object> deliver(WebhookConfigEntity config, String event, Map<String, Object> payload) {
        Map<String, Object> outcome = new LinkedHashMap<>();
        outcome.put("event", event);
        outcome.put("url", config.getUrl());
        try {
            String body = objectMapper.writeValueAsString(payload);
            long timestamp = System.currentTimeMillis() / 1000;

            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(config.getUrl()))
                    .timeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                    .header("Content-Type", "application/json; charset=utf-8")
                    .header("X-DL-Event", event)
                    .header("X-DL-Timestamp", String.valueOf(timestamp))
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
            if (config.getSecret() != null && !config.getSecret().isBlank()) {
                builder.header("X-DL-Signature", "sha256=" + hmacSha256(config.getSecret(), timestamp + "." + body));
            }

            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            boolean success = response.statusCode() >= 200 && response.statusCode() < 300;
            governanceMetrics.recordWebhookDelivery(success, event);
            outcome.put("success", success);
            outcome.put("statusCode", response.statusCode());
            if (success) {
                log.info("Webhook delivered: event={} url={} status={}", event, config.getUrl(), response.statusCode());
            } else {
                log.warn("Webhook rejected: event={} url={} status={}", event, config.getUrl(), response.statusCode());
            }
        } catch (Exception e) {
            governanceMetrics.recordWebhookDelivery(false, event);
            outcome.put("success", false);
            outcome.put("error", e.getMessage());
            log.warn("Webhook delivery failed: event={} url={} error={}", event, config.getUrl(), e.getMessage());
        }
        return outcome;
    }

    /** Creates a config with defaults; secret may be blank (unsigned deliveries). */
    public WebhookConfigEntity create(WebhookConfigEntity config) {
        if (config.getName() == null || config.getName().isBlank()) {
            throw new IllegalArgumentException("webhook name is required");
        }
        if (config.getUrl() == null || !config.getUrl().startsWith("http")) {
            throw new IllegalArgumentException("webhook url must be http(s)");
        }
        if (config.getEnabled() == null) {
            config.setEnabled(true);
        }
        config.setCreatedAt(LocalDateTime.now());
        webhookConfigMapper.insert(config);
        return config;
    }

    public WebhookConfigEntity update(String id, WebhookConfigEntity patch) {
        WebhookConfigEntity existing = webhookConfigMapper.selectById(id);
        if (existing == null) {
            throw new IllegalArgumentException("webhook not found: " + id);
        }
        if (patch.getName() != null && !patch.getName().isBlank()) {
            existing.setName(patch.getName());
        }
        if (patch.getUrl() != null && !patch.getUrl().isBlank()) {
            existing.setUrl(patch.getUrl());
        }
        if (patch.getEvents() != null) {
            existing.setEvents(patch.getEvents());
        }
        if (patch.getEnabled() != null) {
            existing.setEnabled(patch.getEnabled());
        }
        // Masked secret round-trip: the UI sends back the mask when unchanged.
        if (patch.getSecret() != null && !"******".equals(patch.getSecret())) {
            existing.setSecret(patch.getSecret().isBlank() ? null : patch.getSecret());
        }
        existing.setUpdatedAt(LocalDateTime.now());
        webhookConfigMapper.updateById(existing);
        return webhookConfigMapper.selectById(id);
    }

    public void delete(String id) {
        webhookConfigMapper.deleteById(id);
    }

    private boolean subscribes(WebhookConfigEntity config, String event) {
        List<String> events = config.getEvents();
        return events == null || events.isEmpty() || events.contains(event);
    }

    private String hmacSha256(String secret, String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }

    @PreDestroy
    void shutdown() {
        deliveryExecutor.shutdownNow();
    }
}
