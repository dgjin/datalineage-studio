package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.AssetColumnEntity;
import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.ContractEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.AssetColumnMapper;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.ContractMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.yaml.snakeyaml.Yaml;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Data contract management service.
 * Handles contract registry, YAML storage and basic structure validation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ContractService {

    private final ContractMapper contractMapper;
    private final AssetMapper assetMapper;
    private final AssetColumnMapper assetColumnMapper;

    public List<ContractEntity> listContracts(String domain, String status) {
        QueryWrapper<ContractEntity> wrapper = new QueryWrapper<>();
        if (domain != null && !domain.isEmpty()) {
            wrapper.eq("domain", domain);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        wrapper.orderByDesc("last_updated");
        return contractMapper.selectList(wrapper);
    }

    public ContractEntity getContract(String id) {
        ContractEntity contract = contractMapper.selectById(id);
        if (contract == null) {
            throw new BusinessException("Contract not found: " + id);
        }
        return contract;
    }

    public ContractEntity getContractByPath(String path) {
        return contractMapper.findByPath(path);
    }

    @Transactional
    public ContractEntity createContract(ContractEntity contract) {
        if (contract.getPath() == null || contract.getPath().isEmpty()) {
            throw new BusinessException("Contract path is required");
        }
        if (contractMapper.findByPath(contract.getPath()) != null) {
            throw new BusinessException("Contract already exists at path: " + contract.getPath());
        }
        if (contract.getStatus() == null) {
            contract.setStatus("DRAFT");
        }
        contract.setLastUpdated(LocalDateTime.now());
        contractMapper.insert(contract);
        return contract;
    }

    @Transactional
    public ContractEntity updateContract(String id, ContractEntity contract) {
        getContract(id);
        contract.setId(id);
        contract.setLastUpdated(LocalDateTime.now());
        contractMapper.updateById(contract);
        return contractMapper.selectById(id);
    }

    @Transactional
    public void deleteContract(String id) {
        getContract(id);
        contractMapper.deleteById(id);
    }

    /**
     * Perform basic structural validation on a contract YAML payload.
     * Checks required top-level fields: domain, version, schema.
     */
    public Map<String, Object> validateContractYaml(String yamlContent) {
        Map<String, Object> result = new HashMap<>();
        List<String> errors = new java.util.ArrayList<>();

        if (yamlContent == null || yamlContent.trim().isEmpty()) {
            errors.add("Contract content is empty");
        } else {
            String content = yamlContent.toLowerCase();
            if (!content.contains("domain")) {
                errors.add("Missing required field: domain");
            }
            if (!content.contains("version")) {
                errors.add("Missing required field: version");
            }
            if (!content.contains("schema") && !content.contains("columns")) {
                errors.add("Missing schema/columns section");
            }
        }

        result.put("valid", errors.isEmpty());
        result.put("errors", errors);
        return result;
    }

    /**
     * Validate a contract's declared columns against the actual asset schema (evaluation
     * report gap #11). The contract's YAML assetId anchor binds it to an asset (dataset
     * name vs code/name is the fallback); declared columns are compared with asset_columns
     * rows: columns missing in the asset and type mismatches fail validation, extra asset
     * columns are reported as coverage warnings (not violations). Type comparison ignores
     * length/precision (VARCHAR(30) == VARCHAR(64)).
     */
    public Map<String, Object> validateAgainstSchema(String contractId) {
        ContractEntity contract = getContract(contractId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("contractId", contract.getId());
        result.put("contractPath", contract.getPath());

        Map<String, Object> yaml = parseContractYaml(contract.getYamlContent());
        List<Map<String, Object>> contractColumns = extractContractColumns(yaml);
        result.put("contractColumnCount", contractColumns.size());

        if (contractColumns.isEmpty()) {
            result.put("valid", false);
            result.put("reason", "契约 YAML 中未解析到 columns 段，无法进行结构校验");
            return result;
        }

        AssetEntity asset = resolveContractAsset(yaml, contract);
        if (asset == null) {
            result.put("valid", false);
            result.put("reason", "未找到契约绑定的资产（assetId 锚点与 dataset 名称均未匹配），请先在资产目录确认采集状态");
            return result;
        }
        result.put("assetId", asset.getId());
        result.put("assetCode", asset.getCode());
        result.put("assetName", asset.getName());

        List<AssetColumnEntity> assetColumns = assetColumnMapper.selectList(
                new QueryWrapper<AssetColumnEntity>().eq("asset_id", asset.getId()));
        result.put("assetColumnCount", assetColumns.size());
        Map<String, AssetColumnEntity> byName = assetColumns.stream()
                .filter(c -> c.getName() != null)
                .collect(Collectors.toMap(c -> c.getName().toLowerCase(), c -> c, (a, b) -> a));

        List<Map<String, Object>> missingInAsset = new ArrayList<>();
        List<Map<String, Object>> missingInContract = new ArrayList<>();
        List<Map<String, Object>> typeMismatch = new ArrayList<>();
        Set<String> declared = new HashSet<>();
        int matched = 0;

        for (Map<String, Object> col : contractColumns) {
            String name = str(col.get("name"));
            if (name.isEmpty()) {
                continue;
            }
            declared.add(name.toLowerCase());
            AssetColumnEntity actual = byName.get(name.toLowerCase());
            if (actual == null) {
                missingInAsset.add(Map.of("column", name, "contractType", str(col.get("type"))));
            } else if (!normalizeType(str(col.get("type"))).equals(normalizeType(actual.getType()))) {
                typeMismatch.add(Map.of("column", name,
                        "contractType", str(col.get("type")), "assetType", str(actual.getType())));
            } else {
                matched++;
            }
        }
        for (AssetColumnEntity col : assetColumns) {
            if (col.getName() != null && !declared.contains(col.getName().toLowerCase())) {
                missingInContract.add(Map.of("column", col.getName(), "assetType", str(col.getType())));
            }
        }

        result.put("matchedColumns", matched);
        result.put("missingInAsset", missingInAsset);
        result.put("missingInContract", missingInContract);
        result.put("typeMismatch", typeMismatch);
        // Missing columns / type mismatches are contract violations; extra asset
        // columns are coverage warnings only.
        result.put("valid", missingInAsset.isEmpty() && typeMismatch.isEmpty());
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseContractYaml(String yamlContent) {
        if (yamlContent == null || yamlContent.trim().isEmpty()) {
            return Map.of();
        }
        try {
            Object loaded = new Yaml().load(yamlContent);
            if (loaded instanceof Map) {
                return (Map<String, Object>) loaded;
            }
        } catch (Exception e) {
            log.warn("Contract YAML parse failed: {}", e.getMessage());
        }
        return Map.of();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractContractColumns(Map<String, Object> yaml) {
        Object columns = yaml.get("columns");
        if (columns instanceof List) {
            return ((List<Object>) columns).stream()
                    .filter(c -> c instanceof Map)
                    .map(c -> (Map<String, Object>) c)
                    .collect(Collectors.toList());
        }
        return List.of();
    }

    /** assetId anchor first; dataset name vs asset code/name (normalized) as fallback. */
    private AssetEntity resolveContractAsset(Map<String, Object> yaml, ContractEntity contract) {
        Object anchor = yaml.get("assetId");
        if (anchor != null) {
            AssetEntity byId = assetMapper.selectById(String.valueOf(anchor));
            if (byId != null) {
                return byId;
            }
        }
        Object dataset = yaml.get("dataset");
        if (dataset == null) {
            String path = contract.getPath() == null ? "" : contract.getPath();
            int slash = path.lastIndexOf('/');
            int dot = path.lastIndexOf('.');
            dataset = slash >= 0 && dot > slash ? path.substring(slash + 1, dot) : path;
        }
        String want = normalizeName(String.valueOf(dataset));
        if (want.isEmpty()) {
            return null;
        }
        for (AssetEntity asset : assetMapper.selectList(null)) {
            if (normalizeName(asset.getName()).equals(want)
                    || normalizeName(asset.getCode()).equals(want)) {
                return asset;
            }
        }
        return null;
    }

    private String normalizeName(String s) {
        return s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    /** Type comparison ignores length/precision and common aliases (INTEGER == INT). */
    private String normalizeType(String type) {
        if (type == null) {
            return "";
        }
        String t = type.trim().toUpperCase();
        int idx = t.indexOf('(');
        if (idx > 0) {
            t = t.substring(0, idx);
        }
        if ("INTEGER".equals(t)) {
            t = "INT";
        }
        return t;
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }
}
