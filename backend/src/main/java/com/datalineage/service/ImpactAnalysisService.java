package com.datalineage.service;

import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.LineageEdgeEntity;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.LineageEdgeMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Impact analysis engine.
 * Performs BFS downstream traversal over the lineage graph to compute
 * blast radius, and supports What-If simulation for hypothetical changes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ImpactAnalysisService {

    private final LineageEdgeMapper lineageEdgeMapper;
    private final AssetMapper assetMapper;

    /**
     * Analyze the downstream impact of an asset (blast radius).
     */
    public Map<String, Object> analyzeImpact(String assetId) {
        List<LineageEdgeEntity> allEdges = lineageEdgeMapper.selectList(null);
        Map<String, List<LineageEdgeEntity>> adjacency = buildAdjacency(allEdges);

        // BFS downstream traversal with distance tracking
        Queue<String> queue = new LinkedList<>();
        Set<String> visited = new HashSet<>();
        Map<String, Integer> distances = new LinkedHashMap<>();
        Map<String, List<String>> impactPaths = new HashMap<>();
        // Asset-id chain from the root to each impacted node (for critical path rendering)
        Map<String, List<String>> pathNodeIds = new HashMap<>();

        queue.offer(assetId);
        visited.add(assetId);
        distances.put(assetId, 0);
        pathNodeIds.put(assetId, new ArrayList<>(List.of(assetId)));

        while (!queue.isEmpty()) {
            String current = queue.poll();
            int currentDistance = distances.get(current);
            if (currentDistance >= 10) continue; // Max depth guard

            for (LineageEdgeEntity edge : adjacency.getOrDefault(current, Collections.emptyList())) {
                String next = edge.getToAssetId();
                if (!visited.contains(next)) {
                    visited.add(next);
                    distances.put(next, currentDistance + 1);
                    List<String> path = new ArrayList<>(impactPaths.getOrDefault(current, Collections.emptyList()));
                    path.add(edge.getId());
                    impactPaths.put(next, path);
                    List<String> nodePath = new ArrayList<>(pathNodeIds.getOrDefault(current, List.of(current)));
                    nodePath.add(next);
                    pathNodeIds.put(next, nodePath);
                    queue.offer(next);
                }
            }
        }

        // Classify impacted assets by type
        int affectedMetrics = 0, affectedReports = 0, affectedApis = 0, affectedTables = 0;
        List<Map<String, Object>> impactedAssets = new ArrayList<>();

        for (Map.Entry<String, Integer> entry : distances.entrySet()) {
            if (entry.getKey().equals(assetId)) continue;
            AssetEntity asset = assetMapper.selectById(entry.getKey());
            if (asset == null) continue;

            String type = asset.getType() == null ? "TABLE" : asset.getType();
            switch (type) {
                case "METRIC": affectedMetrics++; break;
                case "REPORT":
                case "DASHBOARD": affectedReports++; break;
                case "API": affectedApis++; break;
                default: affectedTables++; break;
            }

            boolean isCritical = impactPaths.get(entry.getKey()) != null
                    && impactPaths.get(entry.getKey()).stream()
                        .anyMatch(edgeId -> {
                            LineageEdgeEntity edge = findEdge(allEdges, edgeId);
                            return edge != null && Boolean.TRUE.equals(edge.getIsCriticalPath());
                        });

            Map<String, Object> impacted = new HashMap<>();
            impacted.put("assetId", entry.getKey());
            impacted.put("assetName", asset.getName());
            impacted.put("displayTitle", asset.getDisplayTitle());
            impacted.put("type", type);
            impacted.put("layer", asset.getLayer());
            impacted.put("owner", asset.getOwner());
            impacted.put("department", asset.getDepartment());
            impacted.put("distance", entry.getValue());
            impacted.put("isCriticalPath", isCritical);
            impacted.put("pathAssetIds", pathNodeIds.getOrDefault(entry.getKey(), List.of()));
            impactedAssets.add(impacted);
        }

        // Sort by distance ascending
        impactedAssets.sort(Comparator.comparingInt(a -> (Integer) a.get("distance")));

        // Compute impact verdict
        String verdict = computeVerdict(affectedMetrics, affectedReports, affectedApis, affectedTables,
                distances.size() - 1, impactedAssets);

        String summary = String.format(
                "Blast radius: %d downstream assets (%d metrics, %d reports, %d APIs, %d tables)",
                distances.size() - 1, affectedMetrics, affectedReports, affectedApis, affectedTables);

        Map<String, Object> result = new HashMap<>();
        result.put("assetId", assetId);
        result.put("verdict", verdict);
        result.put("summary", summary);
        result.put("totalImpacted", distances.size() - 1);
        result.put("affectedMetrics", affectedMetrics);
        result.put("affectedReports", affectedReports);
        result.put("affectedApis", affectedApis);
        result.put("affectedTables", affectedTables);
        result.put("impactedAssets", impactedAssets);
        return result;
    }

    /**
     * What-If simulation: predict the impact of a hypothetical schema change
     * without applying it.
     */
    public Map<String, Object> simulateWhatIf(String assetId, String changeType, String columnName) {
        Map<String, Object> impact = analyzeImpact(assetId);

        // Adjust verdict based on the hypothetical change characteristics
        String baseVerdict = String.valueOf(impact.get("verdict"));
        String simulatedVerdict = adjustVerdictForChange(baseVerdict, changeType);

        List<Map<String, Object>> impacted = castList(impact.get("impactedAssets"));
        int blockedCount = 0;
        List<Map<String, Object>> blockers = new ArrayList<>();

        for (Map<String, Object> item : impacted) {
            String type = String.valueOf(item.get("type"));
            boolean isCritical = Boolean.TRUE.equals(item.get("isCriticalPath"));
            // Breaking change on critical path blocks downstream reports/metrics
            if (isCritical && ("REPORT".equals(type) || "DASHBOARD".equals(type) || "METRIC".equals(type))) {
                blockedCount++;
                Map<String, Object> blocker = new HashMap<>(item);
                blocker.put("reason", "Critical path asset affected by " + changeType);
                blockers.add(blocker);
            }
        }

        if (blockedCount > 0) {
            simulatedVerdict = "BLOCKER";
        }

        Map<String, Object> result = new HashMap<>(impact);
        result.put("simulated", true);
        result.put("changeType", changeType);
        result.put("columnName", columnName);
        result.put("verdict", simulatedVerdict);
        result.put("blockedCount", blockedCount);
        result.put("blockers", blockers);
        result.put("recommendation", buildRecommendation(simulatedVerdict, changeType, blockedCount));
        return result;
    }

    private Map<String, List<LineageEdgeEntity>> buildAdjacency(List<LineageEdgeEntity> edges) {
        Map<String, List<LineageEdgeEntity>> adjacency = new HashMap<>();
        for (LineageEdgeEntity edge : edges) {
            adjacency.computeIfAbsent(edge.getFromAssetId(), k -> new ArrayList<>()).add(edge);
        }
        return adjacency;
    }

    private LineageEdgeEntity findEdge(List<LineageEdgeEntity> edges, String edgeId) {
        return edges.stream().filter(e -> edgeId.equals(e.getId())).findFirst().orElse(null);
    }

    private String computeVerdict(int metrics, int reports, int apis, int tables, int total,
                                  List<Map<String, Object>> impactedAssets) {
        boolean touchesCriticalPath = impactedAssets.stream()
                .anyMatch(a -> Boolean.TRUE.equals(a.get("isCriticalPath")));
        if (touchesCriticalPath && (reports > 0 || metrics > 0)) return "BLOCKER";
        if (metrics > 0 || reports > 0) return "HIGH";
        if (apis > 0 || total > 5) return "MEDIUM";
        if (total > 0) return "LOW";
        return "SAFE";
    }

    private String adjustVerdictForChange(String baseVerdict, String changeType) {
        boolean breaking = "DROP_COLUMN".equals(changeType) || "DROP_TABLE".equals(changeType)
                || "RENAME_COLUMN".equals(changeType) || "CHANGE_DATA_TYPE".equals(changeType);
        if (!breaking) return baseVerdict;
        switch (baseVerdict) {
            case "SAFE": return "LOW";
            case "LOW": return "MEDIUM";
            case "MEDIUM": return "HIGH";
            case "HIGH": return "BLOCKER";
            default: return baseVerdict;
        }
    }

    private String buildRecommendation(String verdict, String changeType, int blockedCount) {
        switch (verdict) {
            case "BLOCKER":
                return "Blocking change: " + blockedCount + " critical downstream assets affected. "
                        + "Requires impact acknowledgment from all owners before proceeding.";
            case "HIGH":
                return "High impact change (" + changeType + "): notify all downstream owners and schedule migration window.";
            case "MEDIUM":
                return "Medium impact: review affected APIs and reports, update contracts accordingly.";
            case "LOW":
                return "Low impact: proceed with standard review process.";
            default:
                return "Safe change: no significant downstream impact detected.";
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castList(Object obj) {
        if (obj instanceof List) {
            return (List<Map<String, Object>>) obj;
        }
        return Collections.emptyList();
    }
}
