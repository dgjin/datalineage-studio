package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.AssetColumnEntity;
import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.MetricEntity;
import com.datalineage.entity.MetricHistoryEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.AssetColumnMapper;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.MetricHistoryMapper;
import com.datalineage.mapper.MetricMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
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
    private final AssetMapper assetMapper;
    private final AssetColumnMapper assetColumnMapper;

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

        // Publish gate: a metric transitioning to PUBLISHED must have every
        // referenced physical column resolvable against collected metadata.
        if ("PUBLISHED".equals(metric.getStatus()) && !"PUBLISHED".equals(existing.getStatus())) {
            validateReferencedColumns(metric);
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

    /**
     * Verify that every referenced column of the metric points to a real asset
     * column; blocks publishing metrics with dangling caliber bindings.
     */
    private void validateReferencedColumns(MetricEntity metric) {
        List<MetricEntity.ReferencedColumn> refs = metric.getReferencedColumns();
        if (refs == null || refs.isEmpty()) {
            return;
        }
        List<String> missing = new ArrayList<>();
        for (MetricEntity.ReferencedColumn ref : refs) {
            AssetEntity asset = null;
            if (ref.getAssetId() != null && !ref.getAssetId().isBlank()) {
                asset = assetMapper.selectById(ref.getAssetId());
            }
            if (asset == null && ref.getAssetName() != null && !ref.getAssetName().isBlank()) {
                asset = assetMapper.selectOne(new QueryWrapper<AssetEntity>()
                        .eq("name", ref.getAssetName()).last("LIMIT 1"));
            }
            if (asset == null) {
                missing.add(ref.getAssetName() != null ? ref.getAssetName() : ref.getAssetId());
                continue;
            }
            if (ref.getColumnName() != null && !ref.getColumnName().isBlank()) {
                Long count = assetColumnMapper.selectCount(new QueryWrapper<AssetColumnEntity>()
                        .eq("asset_id", asset.getId())
                        .eq("name", ref.getColumnName()));
                if (count == null || count == 0) {
                    missing.add(asset.getName() + "." + ref.getColumnName());
                }
            }
        }
        if (!missing.isEmpty()) {
            throw new BusinessException("指标发布校验失败：引用的物理列不存在 - " + String.join(", ", missing));
        }
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
