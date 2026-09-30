package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.DataStandardEntity;
import com.datalineage.entity.GlossaryTermEntity;
import com.datalineage.entity.QualityIssueEntity;
import com.datalineage.entity.ReferenceCodeEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.DataStandardMapper;
import com.datalineage.mapper.GlossaryTermMapper;
import com.datalineage.mapper.QualityIssueMapper;
import com.datalineage.mapper.ReferenceCodeMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;
import java.util.stream.Collectors;

/**
 * Data standard hub: the central "标准设计/管理/维护" loop.
 * Owns naming/coding/metric/domain standards, the business glossary and
 * reference code dictionaries, and turns naming-standard hits into quality
 * issues so the collect -> check -> fix loop closes automatically.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StandardService {

    private final DataStandardMapper standardMapper;
    private final GlossaryTermMapper glossaryTermMapper;
    private final ReferenceCodeMapper referenceCodeMapper;
    private final AssetMapper assetMapper;
    private final QualityIssueMapper qualityIssueMapper;

    // ---- Standards ----

    public List<DataStandardEntity> listStandards(String type, String status, String domain) {
        QueryWrapper<DataStandardEntity> wrapper = new QueryWrapper<>();
        if (type != null && !type.isEmpty()) {
            wrapper.eq("type", type);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        if (domain != null && !domain.isEmpty()) {
            wrapper.eq("domain", domain);
        }
        wrapper.orderByAsc("code");
        return standardMapper.selectList(wrapper);
    }

    public DataStandardEntity getStandard(String id) {
        DataStandardEntity std = standardMapper.selectById(id);
        if (std == null) {
            throw new BusinessException("Data standard not found: " + id);
        }
        return std;
    }

    @Transactional
    public DataStandardEntity createStandard(DataStandardEntity std) {
        if (std.getCode() == null || std.getCode().isEmpty()) {
            throw new BusinessException("Standard code is required");
        }
        if (std.getName() == null || std.getName().isEmpty()) {
            throw new BusinessException("Standard name is required");
        }
        if (std.getType() == null || std.getType().isEmpty()) {
            throw new BusinessException("Standard type is required (NAMING/CODING/METRIC/DOMAIN)");
        }
        Long dup = standardMapper.selectCount(
                new QueryWrapper<DataStandardEntity>().eq("code", std.getCode()));
        if (dup != null && dup > 0) {
            throw new BusinessException("Standard code already exists: " + std.getCode());
        }
        if (std.getStatus() == null) {
            std.setStatus("DRAFT");
        }
        if (std.getVersion() == null) {
            std.setVersion("v1.0");
        }
        if (std.getHitCount() == null) {
            std.setHitCount(0);
        }
        standardMapper.insert(std);
        return std;
    }

    @Transactional
    public DataStandardEntity updateStandard(String id, DataStandardEntity std) {
        getStandard(id);
        std.setId(id);
        standardMapper.updateById(std);
        return standardMapper.selectById(id);
    }

    /** Publish gate: a NAMING standard can only be published when its rule compiles. */
    @Transactional
    public DataStandardEntity publishStandard(String id) {
        DataStandardEntity std = getStandard(id);
        if ("NAMING".equals(std.getType()) && std.getRuleExpr() != null && !std.getRuleExpr().isBlank()) {
            try {
                Pattern.compile(std.getRuleExpr());
            } catch (PatternSyntaxException e) {
                throw new BusinessException("命名规则无法编译为正则表达式: " + e.getMessage());
            }
        }
        std.setStatus("PUBLISHED");
        standardMapper.updateById(std);
        return standardMapper.selectById(id);
    }

    @Transactional
    public void deleteStandard(String id) {
        getStandard(id);
        standardMapper.deleteById(id);
    }

    // ---- Glossary ----

    public List<GlossaryTermEntity> listGlossary(String domain, String category, String keyword) {
        QueryWrapper<GlossaryTermEntity> wrapper = new QueryWrapper<>();
        if (domain != null && !domain.isEmpty()) {
            wrapper.eq("domain", domain);
        }
        if (category != null && !category.isEmpty()) {
            wrapper.eq("category", category);
        }
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like("term", keyword).or().like("abbr", keyword)
                    .or().like("definition", keyword));
        }
        wrapper.orderByAsc("abbr");
        return glossaryTermMapper.selectList(wrapper);
    }

    @Transactional
    public GlossaryTermEntity createGlossary(GlossaryTermEntity term) {
        if (term.getTerm() == null || term.getTerm().isEmpty()
                || term.getAbbr() == null || term.getAbbr().isEmpty()) {
            throw new BusinessException("Glossary term and abbr are required");
        }
        Long dup = glossaryTermMapper.selectCount(
                new QueryWrapper<GlossaryTermEntity>().eq("abbr", term.getAbbr()));
        if (dup != null && dup > 0) {
            throw new BusinessException("Glossary abbr already exists: " + term.getAbbr());
        }
        if (term.getStatus() == null) {
            term.setStatus("DRAFT");
        }
        if (term.getVersion() == null) {
            term.setVersion("v1.0");
        }
        if (term.getCategory() == null) {
            term.setCategory("ROOT");
        }
        glossaryTermMapper.insert(term);
        return term;
    }

    @Transactional
    public GlossaryTermEntity updateGlossary(String id, GlossaryTermEntity term) {
        if (glossaryTermMapper.selectById(id) == null) {
            throw new BusinessException("Glossary term not found: " + id);
        }
        term.setId(id);
        glossaryTermMapper.updateById(term);
        return glossaryTermMapper.selectById(id);
    }

    @Transactional
    public void deleteGlossary(String id) {
        glossaryTermMapper.deleteById(id);
    }

    // ---- Reference codes ----

    public List<ReferenceCodeEntity> listCodes(String codeSet) {
        QueryWrapper<ReferenceCodeEntity> wrapper = new QueryWrapper<>();
        if (codeSet != null && !codeSet.isEmpty()) {
            wrapper.eq("code_set", codeSet);
        }
        wrapper.orderByAsc("code_set").orderByAsc("sort_order");
        return referenceCodeMapper.selectList(wrapper);
    }

    /** Distinct code sets with member counts, for the dictionary overview. */
    public List<Map<String, Object>> listCodeSets() {
        List<ReferenceCodeEntity> all = referenceCodeMapper.selectList(null);
        Map<String, List<ReferenceCodeEntity>> grouped = all.stream()
                .collect(Collectors.groupingBy(ReferenceCodeEntity::getCodeSet, LinkedHashMap::new, Collectors.toList()));
        List<Map<String, Object>> result = new ArrayList<>();
        grouped.forEach((set, items) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("codeSet", set);
            m.put("setName", items.isEmpty() ? set : items.get(0).getSetName());
            m.put("count", items.size());
            m.put("values", items);
            result.add(m);
        });
        return result;
    }

    @Transactional
    public ReferenceCodeEntity createCode(ReferenceCodeEntity code) {
        if (code.getCodeSet() == null || code.getCodeValue() == null) {
            throw new BusinessException("codeSet and codeValue are required");
        }
        Long dup = referenceCodeMapper.selectCount(new QueryWrapper<ReferenceCodeEntity>()
                .eq("code_set", code.getCodeSet())
                .eq("code_value", code.getCodeValue()));
        if (dup != null && dup > 0) {
            throw new BusinessException("Code already exists: " + code.getCodeSet() + "." + code.getCodeValue());
        }
        if (code.getStatus() == null) {
            code.setStatus("ACTIVE");
        }
        referenceCodeMapper.insert(code);
        return code;
    }

    @Transactional
    public ReferenceCodeEntity updateCode(String id, ReferenceCodeEntity code) {
        if (referenceCodeMapper.selectById(id) == null) {
            throw new BusinessException("Reference code not found: " + id);
        }
        code.setId(id);
        referenceCodeMapper.updateById(code);
        return referenceCodeMapper.selectById(id);
    }

    @Transactional
    public void deleteCode(String id) {
        referenceCodeMapper.deleteById(id);
    }

    // ---- Naming checks (the closing loop: collect -> check -> issue) ----

    /**
     * Check one asset name against all PUBLISHED naming standards.
     * A violation creates a quality issue (idempotent by code) and bumps the
     * standard's hit counter, feeding the "校验 -> 标准迭代" feedback loop.
     */
    @Transactional
    public List<String> checkAssetNaming(AssetEntity asset) {
        List<String> violations = new ArrayList<>();
        if (asset == null || asset.getName() == null) {
            return violations;
        }
        List<DataStandardEntity> namingStandards = standardMapper.selectList(
                new QueryWrapper<DataStandardEntity>()
                        .eq("type", "NAMING")
                        .eq("status", "PUBLISHED"));
        for (DataStandardEntity std : namingStandards) {
            if (std.getRuleExpr() == null || std.getRuleExpr().isBlank()) {
                continue;
            }
            boolean matched;
            try {
                matched = Pattern.compile(std.getRuleExpr()).matcher(asset.getName()).matches();
            } catch (PatternSyntaxException e) {
                log.warn("Skip invalid regex on standard {}: {}", std.getCode(), e.getMessage());
                continue;
            }
            if (!matched) {
                violations.add(std.getCode());
                recordNamingViolation(asset, std);
            }
        }
        return violations;
    }

    /** Run the naming check across every asset. Returns a summary report. */
    @Transactional
    public Map<String, Object> executeNamingCheck() {
        List<AssetEntity> assets = assetMapper.selectList(null);
        int checked = assets.size();
        int violationAssets = 0;
        int newIssues = 0;
        List<Map<String, Object>> details = new ArrayList<>();
        for (AssetEntity asset : assets) {
            List<String> hits = checkAssetNaming(asset);
            if (!hits.isEmpty()) {
                violationAssets++;
                Map<String, Object> d = new LinkedHashMap<>();
                d.put("assetId", asset.getId());
                d.put("assetName", asset.getName());
                d.put("violations", hits);
                details.add(d);
            }
        }
        newIssues += details.size(); // approximated; per-standard issues already persisted
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("checked", checked);
        report.put("violationAssets", violationAssets);
        report.put("details", details);
        report.put("executedAt", java.time.LocalDateTime.now().toString());
        return report;
    }

    private void recordNamingViolation(AssetEntity asset, DataStandardEntity std) {
        // Stable per-asset-per-standard issue code; asset UUIDs share long prefixes
        // so we hash the asset name instead of slicing the id.
        String assetKey = Integer.toHexString(asset.getName().hashCode()).toUpperCase();
        String issueCode = "QI-" + std.getCode().replace("STD-", "") + "-" + assetKey;
        Long existing = qualityIssueMapper.selectCount(
                new QueryWrapper<QualityIssueEntity>().eq("code", issueCode));
        if (existing != null && existing > 0) {
            return; // idempotent: one issue per asset per standard
        }
        QualityIssueEntity issue = new QualityIssueEntity();
        issue.setCode(issueCode);
        issue.setTitle("命名规范违规：" + asset.getName() + " 不符合《" + std.getName() + "》");
        issue.setDescription("资产 " + asset.getName() + " 违反标准 " + std.getCode()
                + "（规则：" + std.getRuleExpr() + "）。示例：" + (std.getExample() == null ? "-" : std.getExample()));
        issue.setIssueType("NAMING_STANDARD");
        issue.setOwnerDept(asset.getDepartment());
        issue.setStatus("OPEN");
        issue.setPriority(std.getSeverity() == null ? "P2" : std.getSeverity());
        issue.setAffectedAssetId(asset.getId());
        issue.setAffectedAssetName(asset.getName());
        issue.setCreatedBy("标准中枢自动校验");
        qualityIssueMapper.insert(issue);

        std.setHitCount((std.getHitCount() == null ? 0 : std.getHitCount()) + 1);
        standardMapper.updateById(std);
    }
}
