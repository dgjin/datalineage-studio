package com.datalineage.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.CollectorAdapterEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.CollectorAdapterMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/collectors")
@RequiredArgsConstructor
@Tag(name = "采集器管理", description = "采集器适配器注册与健康状态")
public class CollectorController {

    private final CollectorAdapterMapper collectorAdapterMapper;

    @GetMapping
    @Operation(summary = "获取采集器列表")
    public ApiResponse<List<CollectorAdapterEntity>> listCollectors(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status) {
        QueryWrapper<CollectorAdapterEntity> wrapper = new QueryWrapper<>();
        if (type != null && !type.isEmpty()) {
            wrapper.eq("type", type);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        wrapper.orderByDesc("updated_at");
        return ApiResponse.success(collectorAdapterMapper.selectList(wrapper));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取采集器详情")
    public ApiResponse<CollectorAdapterEntity> getCollector(@PathVariable String id) {
        CollectorAdapterEntity adapter = collectorAdapterMapper.selectById(id);
        if (adapter == null) {
            throw new BusinessException("Collector adapter not found: " + id);
        }
        return ApiResponse.success(adapter);
    }

    @PostMapping
    @Operation(summary = "注册采集器")
    public ApiResponse<CollectorAdapterEntity> createCollector(@RequestBody CollectorAdapterEntity adapter) {
        if (adapter.getStatus() == null) {
            adapter.setStatus("STANDBY");
        }
        if (adapter.getHealthScore() == null) {
            adapter.setHealthScore(100);
        }
        collectorAdapterMapper.insert(adapter);
        return ApiResponse.success(adapter, "Collector registered");
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新采集器")
    public ApiResponse<CollectorAdapterEntity> updateCollector(@PathVariable String id,
                                                                @RequestBody CollectorAdapterEntity adapter) {
        if (collectorAdapterMapper.selectById(id) == null) {
            throw new BusinessException("Collector adapter not found: " + id);
        }
        adapter.setId(id);
        adapter.setUpdatedAt(LocalDateTime.now());
        collectorAdapterMapper.updateById(adapter);
        return ApiResponse.success(collectorAdapterMapper.selectById(id), "Collector updated");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除采集器")
    public ApiResponse<Void> deleteCollector(@PathVariable String id) {
        if (collectorAdapterMapper.selectById(id) == null) {
            throw new BusinessException("Collector adapter not found: " + id);
        }
        collectorAdapterMapper.deleteById(id);
        return ApiResponse.success(null, "Collector deleted successfully");
    }
}
