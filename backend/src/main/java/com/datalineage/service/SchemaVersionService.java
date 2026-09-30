package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.AssetColumnEntity;
import com.datalineage.entity.AssetSchemaVersionEntity;
import com.datalineage.mapper.AssetSchemaVersionMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Schema version snapshots - the data supply for time-travel queries.
 * A new version is persisted only when the column structure actually changed
 * relative to the latest captured version, keeping the history free of noise.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchemaVersionService {

    private final AssetSchemaVersionMapper schemaVersionMapper;
    private final ObjectMapper objectMapper;

    /**
     * Capture a snapshot for the asset; skips persistence when nothing changed.
     */
    public void capture(String assetId, Collection<AssetColumnEntity> columns) {
        try {
            List<Map<String, Object>> canonical = columns.stream()
                    .map(this::toCanonical)
                    .sorted(Comparator.comparing(m -> String.valueOf(m.get("name"))))
                    .collect(Collectors.toList());
            String snapshotJson = objectMapper.writeValueAsString(canonical);

            AssetSchemaVersionEntity latest = schemaVersionMapper.findLatest(assetId);
            if (latest != null && snapshotJson.equals(latest.getSnapshotJson())) {
                return;
            }

            AssetSchemaVersionEntity entity = new AssetSchemaVersionEntity();
            entity.setAssetId(assetId);
            entity.setVersion(latest == null ? 1 : latest.getVersion() + 1);
            entity.setSnapshotJson(snapshotJson);
            entity.setDiffJson(buildDiff(latest, canonical));
            entity.setCapturedAt(LocalDateTime.now());
            entity.setCreatedAt(LocalDateTime.now());
            schemaVersionMapper.insert(entity);
            log.debug("Captured schema version {} for {}", entity.getVersion(), assetId);
        } catch (Exception e) {
            log.warn("Schema snapshot failed for {}: {}", assetId, e.getMessage());
        }
    }

    public List<AssetSchemaVersionEntity> listVersions(String assetId) {
        return schemaVersionMapper.selectList(new QueryWrapper<AssetSchemaVersionEntity>()
                .eq("asset_id", assetId)
                .orderByDesc("version"));
    }

    public AssetSchemaVersionEntity getVersion(String assetId, int version) {
        return schemaVersionMapper.selectOne(new QueryWrapper<AssetSchemaVersionEntity>()
                .eq("asset_id", assetId)
                .eq("version", version));
    }

    private Map<String, Object> toCanonical(AssetColumnEntity column) {
        Map<String, Object> m = new TreeMap<>();
        m.put("name", column.getName());
        m.put("type", column.getType());
        m.put("nullable", column.getNullable());
        m.put("comment", column.getComment());
        m.put("isPii", column.getIsPii());
        m.put("isPrimary", column.getIsPrimary());
        return m;
    }

    private String buildDiff(AssetSchemaVersionEntity latest, List<Map<String, Object>> current) {
        try {
            List<Map<String, Object>> previous = latest == null
                    ? List.of()
                    : objectMapper.readValue(latest.getSnapshotJson(),
                        new TypeReference<List<Map<String, Object>>>() {});
            Map<String, Map<String, Object>> prev = indexByName(previous);
            Map<String, Map<String, Object>> cur = indexByName(current);

            List<Map<String, Object>> added = new ArrayList<>();
            List<Map<String, Object>> removed = new ArrayList<>();
            List<Map<String, Object>> changed = new ArrayList<>();

            for (Map.Entry<String, Map<String, Object>> e : cur.entrySet()) {
                Map<String, Object> old = prev.get(e.getKey());
                if (old == null) {
                    added.add(Map.of("column", e.getKey(), "type", String.valueOf(e.getValue().get("type"))));
                } else if (!old.equals(e.getValue())) {
                    changed.add(Map.of("column", e.getKey(),
                            "oldType", String.valueOf(old.get("type")),
                            "newType", String.valueOf(e.getValue().get("type"))));
                }
            }
            for (Map.Entry<String, Map<String, Object>> e : prev.entrySet()) {
                if (!cur.containsKey(e.getKey())) {
                    removed.add(Map.of("column", e.getKey(), "type", String.valueOf(e.getValue().get("type"))));
                }
            }

            Map<String, Object> diff = new LinkedHashMap<>();
            diff.put("added", added);
            diff.put("removed", removed);
            diff.put("changed", changed);
            return objectMapper.writeValueAsString(diff);
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, Map<String, Object>> indexByName(List<Map<String, Object>> snapshot) {
        Map<String, Map<String, Object>> byName = new LinkedHashMap<>();
        for (Map<String, Object> m : snapshot) {
            byName.put(String.valueOf(m.get("name")), m);
        }
        return byName;
    }
}
