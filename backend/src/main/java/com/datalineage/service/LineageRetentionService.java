package com.datalineage.service;

import com.datalineage.mapper.LineageEdgeMapper;
import com.datalineage.metrics.GovernanceMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Confidence decay and expiry for auto-discovered lineage edges (evaluation report gap #10).
 *
 * <p>Edges not reproduced by any collection run within the retention window are retired
 * (valid_to set) and their confidence decays, so stale edges stop participating in the
 * live graph and impact analysis while remaining replayable through bi-temporal time
 * travel. Manual (CROSS_SOURCE) and contract-driven edges are never touched.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LineageRetentionService {

    /** Days after the last re-discovery that an auto-discovered edge is retired. */
    public static final int RETENTION_DAYS = 90;

    private final LineageEdgeMapper lineageEdgeMapper;
    private final GovernanceMetrics governanceMetrics;

    /** Daily 02:00 sweep; also invocable manually via POST /lineage/retention/sweep for verification. */
    @Scheduled(cron = "0 0 2 * * ?")
    public void scheduledSweep() {
        sweep();
    }

    /** Retires auto-discovered edges not seen for {@link #RETENTION_DAYS} days. Returns retired count. */
    public int sweep() {
        int expired = lineageEdgeMapper.expireStaleAutoEdges(RETENTION_DAYS);
        if (expired > 0) {
            governanceMetrics.recordLineageEdgesExpired(expired);
            log.info("Lineage retention sweep retired {} auto-discovered edge(s) not seen for {} days",
                    expired, RETENTION_DAYS);
        }
        return expired;
    }
}
