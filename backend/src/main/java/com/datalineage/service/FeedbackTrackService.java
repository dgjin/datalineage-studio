package com.datalineage.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 需求处理进度代理：以服务令牌通道调用「AIOps 自动运维智能体」只读接口
 * GET /api/requirements/track，把需求经「智能分析 → 管理员批准 → 修复发布」的
 * 流转进度（stage / timeline）按条目归集后返回，供「我的反馈」与管理员面板展示。
 *
 * - 未配置 aiops.track-url / aiops.track-token（环境变量 AIOPS_TRACK_URL /
 *   AIOPS_TRACK_TOKEN，对应 AIOps 侧 AIOPS_TRACK_SERVICE_TOKEN）→ configured=false，
 *   前端隐藏进度区；
 * - 上游失败 → ok=false + error（不缓存，下次请求立即重试）；
 * - 成功响应缓存 20 秒（按排序后的 ID 串共享，进度数据与用户无关）。
 */
@Slf4j
@Service
public class FeedbackTrackService {

    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final long CACHE_TTL_MS = 20_000;
    private static final int CACHE_MAX = 200;

    private final String trackUrl;
    private final String trackToken;
    private final String appId;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    /** 进度缓存（key=条目 ID 串，仅成功响应入缓存；插入序淘汰超量键） */
    private final Map<String, CacheEntry> cache = Collections.synchronizedMap(
            new LinkedHashMap<>(16, 0.75f, false) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, CacheEntry> eldest) {
                    return size() > CACHE_MAX;
                }
            });

    public FeedbackTrackService(@Value("${aiops.track-url:}") String trackUrl,
                                @Value("${aiops.track-token:}") String trackToken,
                                @Value("${aiops.track-app-id:datalineage-studio}") String appId,
                                ObjectMapper objectMapper) {
        this.trackUrl = trackUrl == null ? "" : trackUrl.trim().replaceAll("/+$", "");
        this.trackToken = trackToken == null ? "" : trackToken.trim();
        this.appId = appId == null ? "" : appId.trim();
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    }

    /** 集成是否已配置（未配置＝该通道关闭，前端隐藏进度区）。 */
    public boolean configured() {
        return !trackUrl.isEmpty() && !trackToken.isEmpty();
    }

    /**
     * 拉取条目处理进度（带 20s 成功缓存）。
     * 返回 ok=false 时 error 为中文原因，调用方直接展示；绝不抛异常。
     */
    public TrackResult fetch(List<String> entryIds) {
        String cacheKey = entryIds.stream().sorted().collect(Collectors.joining(","));
        CacheEntry hit = cache.get(cacheKey);
        if (hit != null && System.currentTimeMillis() - hit.at < CACHE_TTL_MS) {
            return new TrackResult(true, "", hit.ops, true);
        }
        String url = trackUrl + "/api/requirements/track"
                + "?entry_ids=" + URLEncoder.encode(String.join(",", entryIds), StandardCharsets.UTF_8)
                + "&app_id=" + URLEncoder.encode(appId, StandardCharsets.UTF_8);
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(TIMEOUT)
                    .header("Authorization", "Bearer " + trackToken)
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                return new TrackResult(false, "智能运维系统返回 HTTP " + response.statusCode(), Map.of(), false);
            }
            JsonNode root = objectMapper.readTree(response.body());
            if (!root.path("ok").asBoolean(true)) {
                String detail = root.path("error").asText("");
                return new TrackResult(false, detail.isEmpty() ? "智能运维系统未接受请求" : detail, Map.of(), false);
            }
            Map<String, Object> ops = new LinkedHashMap<>();
            for (JsonNode item : root.path("entries")) {
                String entryId = item.path("entry_id").asText("");
                if (!entryId.isEmpty()) {
                    ops.put(entryId, objectMapper.convertValue(item, Map.class));
                }
            }
            cache.put(cacheKey, new CacheEntry(System.currentTimeMillis(), ops));
            return new TrackResult(true, "", ops, false);
        } catch (HttpTimeoutException e) {
            return new TrackResult(false, "智能运维系统响应超时", Map.of(), false);
        } catch (Exception e) {
            log.warn("AIOps track fetch failed: {}", e.getMessage());
            return new TrackResult(false, "无法连接智能运维系统", Map.of(), false);
        }
    }

    /** 单次进度拉取结果（error 为空串表示成功；cached=true 命中 20s 缓存）。 */
    public record TrackResult(boolean ok, String error, Map<String, Object> ops, boolean cached) {
    }

    private record CacheEntry(long at, Map<String, Object> ops) {
    }
}
