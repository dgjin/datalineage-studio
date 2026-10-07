package com.datalineage.metrics;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.datalineage.entity.ChangeEventEntity;
import com.datalineage.entity.LineageEdgeEntity;
import com.datalineage.entity.QualityIssueEntity;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.ChangeEventMapper;
import com.datalineage.mapper.LineageEdgeMapper;
import com.datalineage.mapper.QualityIssueMapper;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * Business metrics for the governance platform, exposed via Micrometer on
 * /actuator/prometheus (scraped by Prometheus / Grafana dashboards).
 *
 * Counters and timers are pushed by the domain services (collection runs,
 * approval decisions); gauges read live table counts at scrape time, which is
 * a cheap COUNT(*) on indexed tables.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GovernanceMetrics {

    public static final String COLLECTOR_RUNS = "datalineage.collector.runs.total";
    public static final String COLLECTOR_DURATION = "datalineage.collector.run.duration";
    public static final String EDGES_DISCOVERED = "datalineage.lineage.edges.discovered.total";
    public static final String EDGES_EXPIRED = "datalineage.lineage.edges.expired.total";
    public static final String APPROVAL_DECISIONS = "datalineage.approval.decisions.total";
    public static final String APPROVAL_LATENCY = "datalineage.approval.decision.latency";
    public static final String WEBHOOK_DELIVERIES = "datalineage.webhook.deliveries.total";

    private final MeterRegistry registry;
    private final AssetMapper assetMapper;
    private final LineageEdgeMapper lineageEdgeMapper;
    private final QualityIssueMapper qualityIssueMapper;
    private final ChangeEventMapper changeEventMapper;

    @PostConstruct
    void registerGauges() {
        Gauge.builder("datalineage.assets.total", assetMapper, m -> safeCount(() -> m.selectCount(null)))
                .register(registry);
        Gauge.builder("datalineage.lineage.edges.total", lineageEdgeMapper,
                        m -> safeCount(() -> m.selectCount(Wrappers.<LineageEdgeEntity>lambdaQuery()
                                .isNull(LineageEdgeEntity::getValidTo))))
                .register(registry);
        Gauge.builder("datalineage.validation.open.issues", qualityIssueMapper,
                        m -> safeCount(() -> m.selectCount(Wrappers.<QualityIssueEntity>lambdaQuery()
                                .eq(QualityIssueEntity::getStatus, "OPEN"))))
                .register(registry);
        Gauge.builder("datalineage.changes.pending.approval", changeEventMapper,
                        m -> safeCount(() -> m.selectCount(Wrappers.<ChangeEventEntity>lambdaQuery()
                                .eq(ChangeEventEntity::getStatus, "APPROVAL_PENDING"))))
                .register(registry);
        log.info("Governance metric gauges registered: assets / lineage edges / open issues / pending approvals");
    }

    /** Records the outcome of one collection run: success counter, duration timer, new edges. */
    public void recordCollectorRun(boolean success, long durationMs, int edgesDiscovered) {
        registry.counter(COLLECTOR_RUNS, "status", success ? "success" : "failed").increment();
        registry.timer(COLLECTOR_DURATION).record(durationMs, TimeUnit.MILLISECONDS);
        if (edgesDiscovered > 0) {
            registry.counter(EDGES_DISCOVERED).increment(edgesDiscovered);
        }
    }

    /** Records one approval decision plus the latency from change detection to the decision. */
    public void recordApprovalDecision(String action, LocalDateTime createdAt) {
        registry.counter(APPROVAL_DECISIONS, "action", action == null ? "unknown" : action.toLowerCase()).increment();
        if (createdAt != null) {
            long seconds = Math.max(0, Duration.between(createdAt, LocalDateTime.now()).getSeconds());
            registry.timer(APPROVAL_LATENCY).record(seconds, TimeUnit.SECONDS);
        }
    }

    /** Records retired stale edges from the lineage retention sweep. */
    public void recordLineageEdgesExpired(int count) {
        if (count > 0) {
            registry.counter(EDGES_EXPIRED).increment(count);
        }
    }

    /** Records one outbound webhook delivery attempt by result and event. */
    public void recordWebhookDelivery(boolean success, String event) {
        registry.counter(WEBHOOK_DELIVERIES,
                        "result", success ? "success" : "failed",
                        "event", event == null || event.isBlank() ? "unknown" : event)
                .increment();
    }

    /** Gauge queries must never break a scrape: fall back to 0 on any failure. */
    private double safeCount(Supplier<Long> countFn) {
        try {
            Long value = countFn.get();
            return value == null ? 0 : value;
        } catch (Exception e) {
            log.debug("Gauge count query failed: {}", e.getMessage());
            return 0;
        }
    }
}
