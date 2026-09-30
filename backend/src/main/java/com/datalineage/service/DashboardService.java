package com.datalineage.service;

import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.ChangeEventEntity;
import com.datalineage.entity.QualityIssueEntity;
import com.datalineage.entity.ValidationRuleEntity;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.ChangeEventMapper;
import com.datalineage.mapper.DataStandardMapper;
import com.datalineage.mapper.GlossaryTermMapper;
import com.datalineage.mapper.LineageEdgeMapper;
import com.datalineage.mapper.QualityIssueMapper;
import com.datalineage.mapper.ReferenceCodeMapper;
import com.datalineage.mapper.ValidationRuleMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.LineageEdgeEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Governance dashboard aggregation.
 * Replaces the former hardcoded weekly report with live aggregates over
 * assets, changes, quality issues, standards and lineage edges.
 *
 * Asset health score (100 base):
 *   -25 no owner, -20 no contract, -25 open quality issue,
 *   -15 unresolved change, -15 ADS/APP asset without downstream consumers.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final AssetMapper assetMapper;
    private final ChangeEventMapper changeEventMapper;
    private final QualityIssueMapper qualityIssueMapper;
    private final ValidationRuleMapper validationRuleMapper;
    private final LineageEdgeMapper lineageEdgeMapper;
    private final DataStandardMapper dataStandardMapper;
    private final GlossaryTermMapper glossaryTermMapper;
    private final ReferenceCodeMapper referenceCodeMapper;

    private static final Set<String> TERMINAL_CHANGE_STATUS =
            Set.of("RESOLVED", "APPROVED", "REJECTED");

    // ---- Overview ----

    public Map<String, Object> getOverview() {
        List<AssetEntity> assets = assetMapper.selectList(null);
        List<ChangeEventEntity> changes = changeEventMapper.selectList(null);
        List<QualityIssueEntity> issues = qualityIssueMapper.selectList(null);
        List<ValidationRuleEntity> rules = validationRuleMapper.selectList(null);
        List<LineageEdgeEntity> edges = lineageEdgeMapper.selectList(null);

        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("assetTotal", assets.size());
        overview.put("layerDistribution", countBy(assets, AssetEntity::getLayer));
        overview.put("typeDistribution", countBy(assets, AssetEntity::getType));

        // Health distribution
        Set<String> issueAssetIds = openIssueAssetIds(issues);
        Set<String> pendingChangeAssetIds = pendingChangeAssetIds(changes);
        List<Map<String, Object>> healthList = assets.stream()
                .map(a -> buildHealth(a, issueAssetIds, pendingChangeAssetIds))
                .sorted(Comparator.comparingInt(h -> (Integer) h.get("score")))
                .collect(Collectors.toList());
        long healthy = healthList.stream().filter(h -> "HEALTHY".equals(h.get("grade"))).count();
        long attention = healthList.stream().filter(h -> "ATTENTION".equals(h.get("grade"))).count();
        long risk = healthList.stream().filter(h -> "RISK".equals(h.get("grade"))).count();
        double avgScore = healthList.stream()
                .mapToInt(h -> (Integer) h.get("score")).average().orElse(0);
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("healthy", healthy);
        health.put("attention", attention);
        health.put("risk", risk);
        health.put("avgScore", Math.round(avgScore * 10) / 10.0);
        health.put("riskAssets", healthList.stream().limit(5).collect(Collectors.toList()));
        overview.put("health", health);

        // Per-layer average health score for the layer breakdown panel
        Map<String, List<Integer>> scoresByLayer = new HashMap<>();
        for (Map<String, Object> h : healthList) {
            String layer = (String) h.get("layer");
            if (layer != null) {
                scoresByLayer.computeIfAbsent(layer, k -> new ArrayList<>()).add((Integer) h.get("score"));
            }
        }
        Map<String, Double> layerAvg = new LinkedHashMap<>();
        scoresByLayer.forEach((layer, scores) -> layerAvg.put(layer,
                Math.round(scores.stream().mapToInt(Integer::intValue).average().orElse(0) * 10) / 10.0));
        overview.put("assetHealthSummary", layerAvg);

        // Governance coverage
        long ownerCovered = assets.stream()
                .filter(a -> a.getOwner() != null && !a.getOwner().isBlank()).count();
        long contractCovered = assets.stream()
                .filter(a -> a.getContractRef() != null && !a.getContractRef().isBlank()).count();
        Map<String, Object> governance = new LinkedHashMap<>();
        governance.put("ownerCoverage", pct(ownerCovered, assets.size()));
        governance.put("contractCoverage", pct(contractCovered, assets.size()));
        governance.put("standardTotal", dataStandardMapper.selectCount(null));
        governance.put("standardPublished", dataStandardMapper.selectCount(
                new QueryWrapper<com.datalineage.entity.DataStandardEntity>().eq("status", "PUBLISHED")));
        governance.put("glossaryTotal", glossaryTermMapper.selectCount(null));
        governance.put("codeSetTotal", referenceCodeMapper.selectList(null).stream()
                .map(c -> c.getCodeSet()).distinct().count());
        overview.put("governance", governance);

        // Changes
        Map<String, Object> changeStats = new LinkedHashMap<>();
        changeStats.put("total", changes.size());
        changeStats.put("unresolved", changes.stream()
                .filter(c -> !TERMINAL_CHANGE_STATUS.contains(c.getStatus())).count());
        changeStats.put("pendingApproval", changes.stream()
                .filter(c -> "APPROVAL_PENDING".equals(c.getStatus())).count());
        changeStats.put("approvalReleased", changes.stream()
                .filter(c -> "APPROVED".equals(c.getStatus())).count());
        changeStats.put("breaking", changes.stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsBreaking())).count());
        changeStats.put("blockerHigh", changes.stream()
                .filter(c -> "BLOCKER".equals(c.getImpactVerdict()) || "HIGH".equals(c.getImpactVerdict())).count());
        changeStats.put("unmanaged", changes.stream()
                .filter(c -> Boolean.FALSE.equals(c.getIsManaged())).count());
        overview.put("changes", changeStats);

        // Quality
        Map<String, Object> quality = new LinkedHashMap<>();
        quality.put("openIssues", issues.stream()
                .filter(i -> "OPEN".equals(i.getStatus()) || "IN_PROGRESS".equals(i.getStatus())).count());
        quality.put("p0Issues", issues.stream()
                .filter(i -> "P0".equals(i.getPriority())
                        && ("OPEN".equals(i.getStatus()) || "IN_PROGRESS".equals(i.getStatus()))).count());
        quality.put("ruleTotal", rules.size());
        quality.put("ruleEnabled", rules.stream().filter(r -> Boolean.TRUE.equals(r.getEnabled())).count());
        List<Map<String, Object>> topRules = rules.stream()
                .filter(r -> r.getHitCount() != null && r.getHitCount() > 0)
                .sorted(Comparator.comparingInt(ValidationRuleEntity::getHitCount).reversed())
                .limit(5)
                .map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("code", r.getCode());
                    m.put("name", r.getName());
                    m.put("category", r.getCategory());
                    m.put("hitCount", r.getHitCount());
                    m.put("severity", r.getSeverity());
                    return m;
                })
                .collect(Collectors.toList());
        quality.put("topRules", topRules);
        overview.put("quality", quality);

        // Lineage
        Map<String, Object> lineage = new LinkedHashMap<>();
        lineage.put("edgeTotal", edges.size());
        lineage.put("columnEdges", edges.stream().filter(e -> "COLUMN".equals(e.getKind())).count());
        lineage.put("tableEdges", edges.stream().filter(e -> "TABLE".equals(e.getKind())).count());
        Map<String, String> layerById = assets.stream()
                .collect(Collectors.toMap(AssetEntity::getId, a -> a.getLayer() == null ? "?" : a.getLayer(),
                        (a, b) -> a, HashMap::new));
        Map<String, Long> flows = edges.stream()
                .filter(e -> "TABLE".equals(e.getKind()) || e.getKind() == null)
                .filter(e -> layerById.containsKey(e.getFromAssetId()) && layerById.containsKey(e.getToAssetId()))
                .map(e -> layerById.get(e.getFromAssetId()) + " → " + layerById.get(e.getToAssetId()))
                .collect(Collectors.groupingBy(f -> f, LinkedHashMap::new, Collectors.counting()));
        lineage.put("layerFlows", flows);
        overview.put("lineage", lineage);

        // Zombie assets: ADS/APP outputs with no downstream consumer
        List<Map<String, Object>> zombieAssets = assets.stream()
                .filter(a -> ("ADS".equals(a.getLayer()) || "APP".equals(a.getLayer())))
                .filter(a -> a.getDownstreamCount() == null || a.getDownstreamCount() == 0)
                .map(a -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", a.getId());
                    m.put("name", a.getName());
                    m.put("layer", a.getLayer());
                    m.put("owner", a.getOwner());
                    return m;
                })
                .collect(Collectors.toList());
        overview.put("zombieAssets", zombieAssets);

        overview.put("generatedAt", LocalDateTime.now().toString());
        return overview;
    }

    public List<Map<String, Object>> listAssetHealth() {
        List<AssetEntity> assets = assetMapper.selectList(null);
        Set<String> issueAssetIds = openIssueAssetIds(qualityIssueMapper.selectList(null));
        Set<String> pendingChangeAssetIds = pendingChangeAssetIds(changeEventMapper.selectList(null));
        return assets.stream()
                .map(a -> buildHealth(a, issueAssetIds, pendingChangeAssetIds))
                .sorted(Comparator.comparingInt(h -> (Integer) h.get("score")))
                .collect(Collectors.toList());
    }

    public Map<String, Object> getAssetHealth(String assetId) {
        AssetEntity asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new com.datalineage.exception.BusinessException("Asset not found: " + assetId);
        }
        Set<String> issueAssetIds = openIssueAssetIds(qualityIssueMapper.selectList(
                new QueryWrapper<QualityIssueEntity>().eq("affected_asset_id", assetId)));
        Set<String> pendingChangeAssetIds = pendingChangeAssetIds(changeEventMapper.selectList(
                new QueryWrapper<ChangeEventEntity>().eq("asset_id", assetId)));
        return buildHealth(asset, issueAssetIds, pendingChangeAssetIds);
    }

    // ---- Health scoring ----

    private Map<String, Object> buildHealth(AssetEntity asset, Set<String> issueAssetIds,
                                            Set<String> pendingChangeAssetIds) {
        int score = 100;
        List<String> findings = new ArrayList<>();
        if (asset.getOwner() == null || asset.getOwner().isBlank()) {
            score -= 25;
            findings.add("未指定数据责任人（Owner）");
        }
        if (asset.getContractRef() == null || asset.getContractRef().isBlank()) {
            score -= 20;
            findings.add("未绑定数据契约");
        }
        if (issueAssetIds.contains(asset.getId())) {
            score -= 25;
            findings.add("存在未关闭质量问题");
        }
        if (pendingChangeAssetIds.contains(asset.getId())) {
            score -= 15;
            findings.add("存在未决变更");
        }
        if (("ADS".equals(asset.getLayer()) || "APP".equals(asset.getLayer()))
                && (asset.getDownstreamCount() == null || asset.getDownstreamCount() == 0)) {
            score -= 15;
            findings.add("产出层资产无下游消费");
        }
        score = Math.max(score, 0);
        String grade = score >= 85 ? "HEALTHY" : score >= 60 ? "ATTENTION" : "RISK";

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("assetId", asset.getId());
        result.put("assetName", asset.getName());
        result.put("layer", asset.getLayer());
        result.put("owner", asset.getOwner());
        result.put("score", score);
        result.put("grade", grade);
        result.put("findings", findings);
        return result;
    }

    private Set<String> openIssueAssetIds(List<QualityIssueEntity> issues) {
        return issues.stream()
                .filter(i -> "OPEN".equals(i.getStatus()) || "IN_PROGRESS".equals(i.getStatus()))
                .map(QualityIssueEntity::getAffectedAssetId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private Set<String> pendingChangeAssetIds(List<ChangeEventEntity> changes) {
        Set<String> ids = new HashSet<>();
        for (ChangeEventEntity c : changes) {
            if (!TERMINAL_CHANGE_STATUS.contains(c.getStatus())) {
                ids.add(c.getAssetId());
            }
        }
        return ids;
    }

    private Map<String, Long> countBy(List<AssetEntity> assets,
                                      java.util.function.Function<AssetEntity, String> keyFn) {
        return assets.stream()
                .filter(a -> keyFn.apply(a) != null)
                .collect(Collectors.groupingBy(keyFn, LinkedHashMap::new, Collectors.counting()));
    }

    private double pct(long part, long total) {
        if (total == 0) {
            return 0;
        }
        return Math.round(part * 1000.0 / total) / 10.0;
    }
}
