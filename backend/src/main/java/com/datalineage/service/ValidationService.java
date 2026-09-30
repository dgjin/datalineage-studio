package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.AssetColumnEntity;
import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.QualityIssueEntity;
import com.datalineage.entity.ValidationRuleEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.AssetColumnMapper;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.QualityIssueMapper;
import com.datalineage.mapper.ValidationRuleMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Data validation center service.
 * Manages validation rules and quality issues, and executes rule checks over assets.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ValidationService {

    private final ValidationRuleMapper ruleMapper;
    private final QualityIssueMapper qualityIssueMapper;
    private final AssetMapper assetMapper;
    private final AssetColumnMapper assetColumnMapper;

    public List<ValidationRuleEntity> listRules(String category, Boolean enabled) {
        QueryWrapper<ValidationRuleEntity> wrapper = new QueryWrapper<>();
        if (category != null && !category.isEmpty()) {
            wrapper.eq("category", category);
        }
        if (enabled != null) {
            wrapper.eq("enabled", enabled);
        }
        wrapper.orderByDesc("updated_at");
        return ruleMapper.selectList(wrapper);
    }

    public ValidationRuleEntity getRule(String id) {
        ValidationRuleEntity rule = ruleMapper.selectById(id);
        if (rule == null) {
            throw new BusinessException("Validation rule not found: " + id);
        }
        return rule;
    }

    @Transactional
    public ValidationRuleEntity createRule(ValidationRuleEntity rule) {
        if (rule.getCode() == null || rule.getCode().isEmpty()) {
            throw new BusinessException("Rule code is required");
        }
        if (rule.getEnabled() == null) {
            rule.setEnabled(true);
        }
        if (rule.getSeverity() == null) {
            rule.setSeverity("P2");
        }
        rule.setHitCount(0);
        ruleMapper.insert(rule);
        return rule;
    }

    @Transactional
    public ValidationRuleEntity updateRule(String id, ValidationRuleEntity rule) {
        getRule(id);
        rule.setId(id);
        ruleMapper.updateById(rule);
        return ruleMapper.selectById(id);
    }

    @Transactional
    public void deleteRule(String id) {
        getRule(id);
        ruleMapper.deleteById(id);
    }

    public ValidationRuleEntity toggleRule(String id) {
        ValidationRuleEntity rule = getRule(id);
        rule.setEnabled(!Boolean.TRUE.equals(rule.getEnabled()));
        ruleMapper.updateById(rule);
        return rule;
    }

    /**
     * Execute all enabled validation rules against a single asset.
     * Currently supports PII classification consistency and empty-description checks.
     */
    @Transactional
    public Map<String, Object> executeValidation(String assetId) {
        AssetEntity asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new BusinessException("Asset not found: " + assetId);
        }

        List<AssetColumnEntity> columns = assetColumnMapper.selectList(
                new QueryWrapper<AssetColumnEntity>().eq("asset_id", assetId));
        List<ValidationRuleEntity> rules = ruleMapper.findEnabledRules();

        List<Map<String, Object>> violations = new ArrayList<>();

        for (ValidationRuleEntity rule : rules) {
            List<String> issues = checkRule(rule, asset, columns);
            if (!issues.isEmpty()) {
                for (String issue : issues) {
                    Map<String, Object> violation = new HashMap<>();
                    violation.put("ruleId", rule.getId());
                    violation.put("ruleCode", rule.getCode());
                    violation.put("ruleName", rule.getName());
                    violation.put("severity", rule.getSeverity());
                    violation.put("message", issue);
                    violations.add(violation);
                }
                rule.setHitCount((rule.getHitCount() == null ? 0 : rule.getHitCount()) + issues.size());
                ruleMapper.updateById(rule);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("assetId", assetId);
        result.put("assetName", asset.getName());
        result.put("rulesExecuted", rules.size());
        result.put("violationCount", violations.size());
        result.put("violations", violations);
        return result;
    }

    private List<String> checkRule(ValidationRuleEntity rule, AssetEntity asset,
                                   List<AssetColumnEntity> columns) {
        List<String> issues = new ArrayList<>();
        String category = rule.getCategory() == null ? "" : rule.getCategory();

        switch (category) {
            case "COMPLETENESS":
                if (asset.getDescription() == null || asset.getDescription().isEmpty()) {
                    issues.add("Asset description is empty");
                }
                long undocumented = columns.stream()
                        .filter(c -> c.getComment() == null || c.getComment().isEmpty())
                        .count();
                if (undocumented > 0) {
                    issues.add(undocumented + " columns have no comment");
                }
                break;
            case "SEMANTIC":
                if (asset.getOwner() == null || asset.getOwner().isEmpty()) {
                    issues.add("Asset has no owner assigned");
                }
                break;
            case "FORMAT":
                if (asset.getCode() == null || !asset.getCode().matches("[A-Z0-9-]+")) {
                    issues.add("Asset code does not follow UPPER-CASE-HYPHEN format");
                }
                break;
            default:
                break;
        }
        return issues;
    }

    // ---- Quality issues ----

    public List<QualityIssueEntity> listQualityIssues(String status, String priority) {
        QueryWrapper<QualityIssueEntity> wrapper = new QueryWrapper<>();
        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        if (priority != null && !priority.isEmpty()) {
            wrapper.eq("priority", priority);
        }
        wrapper.orderByDesc("created_at");
        return qualityIssueMapper.selectList(wrapper);
    }

    @Transactional
    public QualityIssueEntity createQualityIssue(QualityIssueEntity issue) {
        if (issue.getStatus() == null) {
            issue.setStatus("OPEN");
        }
        if (issue.getPriority() == null) {
            issue.setPriority("P2");
        }
        qualityIssueMapper.insert(issue);
        return issue;
    }

    @Transactional
    public QualityIssueEntity updateQualityIssue(String id, QualityIssueEntity issue) {
        QualityIssueEntity existing = qualityIssueMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException("Quality issue not found: " + id);
        }
        issue.setId(id);
        qualityIssueMapper.updateById(issue);
        return qualityIssueMapper.selectById(id);
    }

    @Transactional
    public void deleteQualityIssue(String id) {
        qualityIssueMapper.deleteById(id);
    }
}
