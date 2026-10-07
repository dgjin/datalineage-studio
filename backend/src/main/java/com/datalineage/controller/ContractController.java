package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.ContractEntity;
import com.datalineage.service.ContractService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/contracts")
@RequiredArgsConstructor
@Tag(name = "数据契约", description = "契约注册与校验")
public class ContractController {

    private final ContractService contractService;

    @GetMapping
    @Operation(summary = "获取契约列表")
    public ApiResponse<List<ContractEntity>> listContracts(
            @RequestParam(required = false) String domain,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(contractService.listContracts(domain, status));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取契约详情")
    public ApiResponse<ContractEntity> getContract(@PathVariable String id) {
        return ApiResponse.success(contractService.getContract(id));
    }

    @GetMapping("/by-path")
    @Operation(summary = "按路径获取契约")
    public ApiResponse<ContractEntity> getContractByPath(@RequestParam String path) {
        return ApiResponse.success(contractService.getContractByPath(path));
    }

    @PostMapping
    @Operation(summary = "注册契约")
    public ApiResponse<ContractEntity> createContract(@RequestBody ContractEntity contract) {
        return ApiResponse.success(contractService.createContract(contract), "Contract registered");
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新契约")
    public ApiResponse<ContractEntity> updateContract(@PathVariable String id,
                                                       @RequestBody ContractEntity contract) {
        return ApiResponse.success(contractService.updateContract(id, contract), "Contract updated");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除契约")
    public ApiResponse<Void> deleteContract(@PathVariable String id) {
        contractService.deleteContract(id);
        return ApiResponse.success(null, "Contract deleted successfully");
    }

    @PostMapping("/validate")
    @Operation(summary = "校验契约 YAML 结构")
    public ApiResponse<Map<String, Object>> validateContract(@RequestBody Map<String, String> request) {
        return ApiResponse.success(contractService.validateContractYaml(request.get("yamlContent")));
    }

    @PostMapping("/{id}/validate-schema")
    @Operation(summary = "契约 vs 资产 schema 一致性校验（字段缺失/类型不符/覆盖度）")
    public ApiResponse<Map<String, Object>> validateAgainstSchema(@PathVariable String id) {
        return ApiResponse.success(contractService.validateAgainstSchema(id));
    }
}
