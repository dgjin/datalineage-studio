package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.ContractEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.ContractMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Data contract management service.
 * Handles contract registry, YAML storage and basic structure validation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ContractService {

    private final ContractMapper contractMapper;

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
}
