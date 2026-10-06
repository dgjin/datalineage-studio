package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.LineageEdgeEntity;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.LineageEdgeMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LineageService {

    private final LineageEdgeMapper lineageEdgeMapper;
    private final AssetMapper assetMapper;

    public List<LineageEdgeEntity> listEdges(String assetId, String kind) {
        QueryWrapper<LineageEdgeEntity> wrapper = new QueryWrapper<>();
        if (assetId != null && !assetId.isEmpty()) {
            wrapper.and(w -> w.eq("from_asset_id", assetId).or().eq("to_asset_id", assetId));
        }
        if (kind != null && !kind.isEmpty()) {
            wrapper.eq("kind", kind);
        }
        return lineageEdgeMapper.selectList(wrapper);
    }

    public List<LineageEdgeEntity> getAssetLineage(String assetId) {
        return lineageEdgeMapper.findByAssetId(assetId);
    }

    public LineageEdgeEntity createEdge(LineageEdgeEntity edge) {
        if (edge.getValidFrom() == null) {
            edge.setValidFrom(java.time.LocalDateTime.now());
        }
        if (edge.getConfidence() == null) {
            edge.setConfidence(100);
        }
        if (edge.getIsCriticalPath() == null) {
            edge.setIsCriticalPath(false);
        }
        lineageEdgeMapper.insert(edge);
        refreshAssetCounts();
        return edge;
    }

    public void deleteEdge(String id) {
        lineageEdgeMapper.deleteById(id);
        refreshAssetCounts();
    }

    /** Recompute denormalized up/downstream counters after manual edge changes. */
    private void refreshAssetCounts() {
        try {
            assetMapper.updateDownstreamCounts();
            assetMapper.updateUpstreamCounts();
            lineageEdgeMapper.refreshCriticalPathFlags();
        } catch (Exception e) {
            log.warn("Failed to refresh asset lineage counters: {}", e.getMessage());
        }
    }

    public Map<String, Object> getLineageGraph(String space, String layer) {
        boolean filtered = (space != null && !space.isEmpty() && !"all".equals(space))
                || (layer != null && !layer.isEmpty());

        QueryWrapper<AssetEntity> wrapper = new QueryWrapper<>();
        if (space != null && !space.isEmpty() && !"all".equals(space)) {
            wrapper.eq("space", space);
        }
        if (layer != null && !layer.isEmpty()) {
            wrapper.eq("layer", layer);
        }
        List<AssetEntity> assets = assetMapper.selectList(wrapper);
        Map<String, AssetEntity> byId = assets.stream()
                .collect(Collectors.toMap(AssetEntity::getId, a -> a, (a, b) -> a));

        List<LineageEdgeEntity> edges = lineageEdgeMapper.selectList(null);
        if (filtered) {
            edges = edges.stream()
                    .filter(e -> byId.containsKey(e.getFromAssetId()) && byId.containsKey(e.getToAssetId()))
                    .collect(Collectors.toList());
        }

        List<Map<String, Object>> nodes = new ArrayList<>();
        for (AssetEntity asset : assets) {
            Map<String, Object> node = new HashMap<>();
            node.put("id", asset.getId());
            node.put("code", asset.getCode());
            node.put("name", asset.getName());
            node.put("displayTitle", asset.getDisplayTitle());
            node.put("type", asset.getType());
            node.put("layer", asset.getLayer());
            node.put("space", asset.getSpace());
            node.put("owner", asset.getOwner());
            node.put("status", asset.getStatus());
            node.put("downstreamCount", asset.getDownstreamCount());
            node.put("upstreamCount", asset.getUpstreamCount());
            nodes.add(node);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("nodes", nodes);
        result.put("edges", edges);
        result.put("nodeCount", nodes.size());
        result.put("edgeCount", edges.size());
        return result;
    }

    /**
     * Extract the subgraph around a root asset up to the given depth.
     * direction: UPSTREAM | DOWNSTREAM | BOTH (default BOTH)
     */
    public Map<String, Object> extractSubgraph(String rootId, int depth, String direction) {
        String dir = direction == null || direction.isEmpty() ? "BOTH" : direction.toUpperCase();
        List<LineageEdgeEntity> allEdges = lineageEdgeMapper.selectList(null);

        Map<String, List<LineageEdgeEntity>> downstream = new HashMap<>();
        Map<String, List<LineageEdgeEntity>> upstream = new HashMap<>();
        for (LineageEdgeEntity edge : allEdges) {
            downstream.computeIfAbsent(edge.getFromAssetId(), k -> new ArrayList<>()).add(edge);
            upstream.computeIfAbsent(edge.getToAssetId(), k -> new ArrayList<>()).add(edge);
        }

        Map<String, Integer> dist = new HashMap<>();
        Set<String> nodeIds = new LinkedHashSet<>();
        Set<String> edgeIds = new HashSet<>();
        Queue<String> queue = new LinkedList<>();
        dist.put(rootId, 0);
        nodeIds.add(rootId);
        queue.offer(rootId);
        int maxDepth = Math.max(depth, 1);

        while (!queue.isEmpty()) {
            String current = queue.poll();
            int d = dist.get(current);
            if (d >= maxDepth) {
                continue;
            }
            List<LineageEdgeEntity> candidates = new ArrayList<>();
            if ("DOWNSTREAM".equals(dir) || "BOTH".equals(dir)) {
                candidates.addAll(downstream.getOrDefault(current, Collections.emptyList()));
            }
            if ("UPSTREAM".equals(dir) || "BOTH".equals(dir)) {
                candidates.addAll(upstream.getOrDefault(current, Collections.emptyList()));
            }
            for (LineageEdgeEntity edge : candidates) {
                edgeIds.add(edge.getId());
                String next = edge.getFromAssetId().equals(current)
                        ? edge.getToAssetId() : edge.getFromAssetId();
                if (!dist.containsKey(next)) {
                    dist.put(next, d + 1);
                    nodeIds.add(next);
                    queue.offer(next);
                }
            }
        }

        List<AssetEntity> nodes = nodeIds.isEmpty()
                ? Collections.emptyList()
                : assetMapper.selectBatchIds(nodeIds);
        List<LineageEdgeEntity> subEdges = allEdges.stream()
                .filter(e -> edgeIds.contains(e.getId()))
                .collect(java.util.stream.Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("rootId", rootId);
        result.put("depth", maxDepth);
        result.put("direction", dir);
        result.put("nodeCount", nodeIds.size());
        result.put("edgeCount", subEdges.size());
        result.put("nodes", nodes);
        result.put("edges", subEdges);
        return result;
    }

    public List<LineageEdgeEntity> findShortestPath(String fromId, String toId) {
        // BFS implementation for shortest path
        List<LineageEdgeEntity> allEdges = lineageEdgeMapper.selectList(null);
        
        // Build adjacency list
        Map<String, List<LineageEdgeEntity>> adj = new HashMap<>();
        for (LineageEdgeEntity edge : allEdges) {
            adj.computeIfAbsent(edge.getFromAssetId(), k -> new ArrayList<>()).add(edge);
        }
        
        // BFS
        Queue<String> queue = new LinkedList<>();
        Set<String> visited = new HashSet<>();
        Map<String, LineageEdgeEntity> parentEdge = new HashMap<>();
        
        queue.offer(fromId);
        visited.add(fromId);
        
        while (!queue.isEmpty()) {
            String current = queue.poll();
            if (current.equals(toId)) {
                // Reconstruct path
                List<LineageEdgeEntity> path = new ArrayList<>();
                String node = toId;
                while (!node.equals(fromId)) {
                    LineageEdgeEntity edge = parentEdge.get(node);
                    if (edge == null) break;
                    path.add(0, edge);
                    node = edge.getFromAssetId();
                }
                return path;
            }
            
            List<LineageEdgeEntity> neighbors = adj.getOrDefault(current, Collections.emptyList());
            for (LineageEdgeEntity edge : neighbors) {
                String next = edge.getToAssetId();
                if (!visited.contains(next)) {
                    visited.add(next);
                    parentEdge.put(next, edge);
                    queue.offer(next);
                }
            }
        }
        
        return Collections.emptyList();
    }
}
