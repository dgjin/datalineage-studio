package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.MetricEntity;
import com.datalineage.entity.MetricHistoryEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.MetricHistoryMapper;
import com.datalineage.mapper.MetricMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Metric definition management service.
 * Handles metric CRUD and version history tracking.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MetricService {

    private final MetricMapper metricMapper;
    private final MetricHistoryMapper metricHistoryMapper;

    public List<MetricEntity> listMetrics(String status, String type, String owner, String keyword) {
        if (keyword != null && !keyword.isEmpty()) {
            return metricMapper.searchByKeyword(keyword);
        }
        QueryWrapper<MetricEntity> wrapper = new QueryWrapper<>();
        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        if (type != null && !type.isEmpty()) {
            wrapper.eq("type", type);
        }
        if (owner != null && !owner.isEmpty()) {
            wrapper.eq("owner", owner);
        }
        wrapper.orderByDesc("updated_at");
        return metricMapper.selectList(wrapper);
    }

    public MetricEntity getMetric(String code) {
        MetricEntity metric = metricMapper.selectById(code);
        if (metric == null) {
            throw new BusinessException("Metric not found: " + code);
        }
        return metric;
    }

    @Transactional
    public MetricEntity createMetric(MetricEntity metric) {
        if (metric.getCode() == null || metric.getCode().isEmpty()) {
            throw new BusinessException("Metric code is required");
        }
        if (metricMapper.selectById(metric.getCode()) != null) {
            throw new BusinessException("Metric already exists: " + metric.getCode());
        }
        if (metric.getStatus() == null) {
            metric.setStatus("DRAFT");
        }
        if (metric.getVersion() == null) {
            metric.setVersion("v1.0");
        }
        metric.setLastModified(LocalDateTime.now());
        metricMapper.insert(metric);

        MetricHistoryEntity history = new MetricHistoryEntity();
        history.setMetricCode(metric.getCode());
        history.setVersion(metric.getVersion());
        history.setDiff("Initial creation");
        history.setBreakingHistoryData(false);
        metricHistoryMapper.insert(history);

        return metric;
    }

    @Transactional
    public MetricEntity updateMetric(String code, MetricEntity metric) {
        MetricEntity existing = getMetric(code);
        metric.setCode(code);
        metric.setLastModified(LocalDateTime.now());
        metric.setUpdatedAt(LocalDateTime.now());

        boolean caliberChanged = metric.getCaliberSummary() != null
                && !metric.getCaliberSummary().equals(existing.getCaliberSummary());
        boolean exprChanged = metric.getMeasureExpr() != null
                && !metric.getMeasureExpr().equals(existing.getMeasureExpr());
        boolean explicitVersionChange = metric.getVersion() != null
                && !metric.getVersion().equals(existing.getVersion());

        // Auto-bump minor version when caliber or measure expression changes
        if ((caliberChanged || exprChanged) && !explicitVersionChange) {
            metric.setVersion(bumpMinor(existing.getVersion()));
        }

        metricMapper.updateById(metric);

        // Record version history if caliber or measure expression changed
        if (caliberChanged || exprChanged || explicitVersionChange) {
            MetricHistoryEntity history = new MetricHistoryEntity();
            history.setMetricCode(code);
            history.setVersion(metric.getVersion() != null ? metric.getVersion() : existing.getVersion());
            history.setDiff(buildDiff(existing, metric));
            history.setBreakingHistoryData(exprChanged);
            metricHistoryMapper.insert(history);
        }

        return metricMapper.selectById(code);
    }

    @Transactional
    public void deleteMetric(String code) {
        getMetric(code);
        metricMapper.deleteById(code);
    }

    public List<MetricHistoryEntity> getMetricHistory(String code) {
        return metricHistoryMapper.findByMetricCode(code);
    }

    public List<MetricEntity> getMetricsByAsset(String assetId) {
        return metricMapper.findByReferencedAsset(assetId);
    }

    private String bumpMinor(String version) {
        if (version == null || !version.matches("v\\d+\\.\\d+")) {
            return "v1.1";
        }
        String[] parts = version.substring(1).split("\\.");
        return "v" + parts[0] + "." + (Integer.parseInt(parts[1]) + 1);
    }

    private String buildDiff(MetricEntity oldMetric, MetricEntity newMetric) {
        StringBuilder diff = new StringBuilder();
        if (newMetric.getCaliberSummary() != null
                && !newMetric.getCaliberSummary().equals(oldMetric.getCaliberSummary())) {
            diff.append("Caliber changed; ");
        }
        if (newMetric.getMeasureExpr() != null
                && !newMetric.getMeasureExpr().equals(oldMetric.getMeasureExpr())) {
            diff.append("Measure expression changed (breaking history comparability); ");
        }
        if (newMetric.getVersion() != null && !newMetric.getVersion().equals(oldMetric.getVersion())) {
            diff.append("Version ").append(oldMetric.getVersion())
                .append(" -> ").append(newMetric.getVersion()).append("; ");
        }
        return diff.length() == 0 ? "Updated" : diff.toString();
    }
}
