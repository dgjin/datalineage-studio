package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.collector.LayerResolver;
import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.LineageEdgeEntity;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.LineageEdgeMapper;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Ingests OpenLineage RunEvents into the lineage graph.
 *
 * Simplifications for this platform:
 *  - every input dataset is linked to every output dataset (TABLE-level edges);
 *  - dataset names are resolved as "schema.table" from the last two dot-segments
 *    (e.g. "mysql://host:3307" + "dl_demo.orders" -> asset:dl_demo.orders);
 *  - unknown datasets are auto-registered (source_type=OPENLINEAGE, unmanaged);
 *  - re-pushing the same event is idempotent (existing OPENLINEAGE edge is kept).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OpenLineageService {

    private final AssetMapper assetMapper;
    private final LineageEdgeMapper lineageEdgeMapper;

    @Transactional
    public Map<String, Object> ingest(JsonNode event) {
        String eventType = event.path("eventType").asText("UNKNOWN");
        JsonNode job = event.path("job");
        String jobNamespace = job.path("namespace").asText("unknown");
        String jobName = job.path("name").asText("unnamed-job");

        List<JsonNode> inputs = asList(event.path("inputs"));
        List<JsonNode> outputs = asList(event.path("outputs"));

        int assetsCreated = 0;
        int edgesCreated = 0;
        int edgesSkipped = 0;
        List<String> registeredAssets = new ArrayList<>();

        for (JsonNode output : outputs) {
            String[] outRef = resolveDataset(output);
            if (outRef == null) {
                continue;
            }
            if (ensureAsset(outRef)) {
                assetsCreated++;
                registeredAssets.add(outRef[0]);
            }
            for (JsonNode input : inputs) {
                String[] inRef = resolveDataset(input);
                if (inRef == null || inRef[0].equals(outRef[0])) {
                    continue;
                }
                if (ensureAsset(inRef)) {
                    assetsCreated++;
                    registeredAssets.add(inRef[0]);
                }

                Long existing = lineageEdgeMapper.selectCount(new QueryWrapper<LineageEdgeEntity>()
                        .eq("from_asset_id", inRef[0])
                        .eq("to_asset_id", outRef[0])
                        .eq("source", "OPENLINEAGE"));
                if (existing != null && existing > 0) {
                    edgesSkipped++;
                    continue;
                }

                LineageEdgeEntity edge = new LineageEdgeEntity();
                edge.setFromAssetId(inRef[0]);
                edge.setToAssetId(outRef[0]);
                edge.setKind("TABLE");
                edge.setSource("OPENLINEAGE");
                edge.setConfidence(100);
                edge.setTransformExpr("job:" + jobNamespace + "." + jobName);
                edge.setIsCriticalPath(false);
                edge.setValidFrom(LocalDateTime.now());
                lineageEdgeMapper.insert(edge);
                edgesCreated++;
            }
        }

        log.info("OpenLineage event {} ({}.{}): {} edges created, {} skipped, {} assets registered",
                eventType, jobNamespace, jobName, edgesCreated, edgesSkipped, assetsCreated);

        Map<String, Object> result = new HashMap<>();
        result.put("eventType", eventType);
        result.put("job", jobNamespace + "." + jobName);
        result.put("edgesCreated", edgesCreated);
        result.put("edgesSkipped", edgesSkipped);
        result.put("assetsCreated", assetsCreated);
        result.put("registeredAssets", registeredAssets);
        return result;
    }

    private List<JsonNode> asList(JsonNode array) {
        List<JsonNode> list = new ArrayList<>();
        if (array != null && array.isArray()) {
            array.forEach(list::add);
        }
        return list;
    }

    /** Resolve a dataset reference to [assetId, schema, table] using the last two name segments. */
    private String[] resolveDataset(JsonNode dataset) {
        String name = dataset.path("name").asText("");
        if (name.isEmpty()) {
            return null;
        }
        String[] parts = name.split("\\.");
        if (parts.length < 2) {
            return null;
        }
        String table = parts[parts.length - 1].trim();
        String schema = parts[parts.length - 2].trim();
        if (table.isEmpty() || schema.isEmpty()) {
            return null;
        }
        return new String[]{"asset:" + schema + "." + table, schema, table};
    }

    /** Auto-register unknown datasets so run-time edges always resolve. */
    private boolean ensureAsset(String[] ref) {
        String assetId = ref[0];
        if (assetMapper.selectById(assetId) != null) {
            return false;
        }
        String schema = ref[1];
        String table = ref[2];

        AssetEntity asset = new AssetEntity();
        asset.setId(assetId);
        asset.setCode(generateCode(table, schema));
        asset.setName(table);
        asset.setDisplayTitle(table);
        asset.setType("TABLE");
        // Route to the warehouse layer matching the naming convention (fallback ODS).
        asset.setLayer(LayerResolver.resolve(table, "ODS"));
        asset.setSpace("default");
        asset.setStatus("ACTIVE");
        asset.setDescription("Registered from OpenLineage events (" + schema + ")");
        asset.setSourceType("OPENLINEAGE");
        asset.setIsManaged(false); // consistent with auto-discovered assets
        asset.setCreatedAt(LocalDateTime.now());
        asset.setUpdatedAt(LocalDateTime.now());
        assetMapper.insert(asset);
        return true;
    }

    private String generateCode(String table, String schema) {
        String cleanName = table.replaceAll("[^a-zA-Z0-9]", "").toUpperCase();
        String shortName = cleanName.substring(0, Math.min(cleanName.length(), 10));
        String hash = Integer.toHexString((schema + "." + table).hashCode()).toUpperCase();
        hash = hash.substring(Math.max(0, hash.length() - 4));
        return "OL-" + shortName + "-" + hash;
    }
}
