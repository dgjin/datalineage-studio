package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.ChangeEventEntity;
import com.datalineage.entity.ImpactAckEntity;
import com.datalineage.service.ChangeService;
import com.datalineage.service.ImpactAnalysisService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/impact")
@RequiredArgsConstructor
@Tag(name = "影响分析", description = "What-If 影响预演与影响确认")
public class ImpactController {

    private final ImpactAnalysisService impactAnalysisService;
    private final ChangeService changeService;

    @GetMapping("/analyze/{assetId}")
    @Operation(summary = "分析资产的下游影响（爆炸半径）")
    public ApiResponse<Map<String, Object>> analyzeImpact(@PathVariable String assetId) {
        return ApiResponse.success(impactAnalysisService.analyzeImpact(assetId));
    }

    @PostMapping("/simulate")
    @Operation(summary = "What-If 影响预演")
    public ApiResponse<Map<String, Object>> simulate(@RequestBody Map<String, String> request) {
        String assetId = request.get("assetId");
        String changeType = request.getOrDefault("changeType", "DROP_COLUMN");
        String columnName = request.get("columnName");
        return ApiResponse.success(impactAnalysisService.simulateWhatIf(assetId, changeType, columnName));
    }

    @GetMapping("/reports")
    @Operation(summary = "影响报告列表（基于变更事件）")
    public ApiResponse<List<ChangeEventEntity>> listReports(
            @RequestParam(required = false) String verdict,
            @RequestParam(required = false) String status) {
        List<ChangeEventEntity> reports = changeService.listChanges(status, null, null);
        if (verdict != null && !verdict.isEmpty()) {
            reports = reports.stream()
                    .filter(c -> verdict.equalsIgnoreCase(c.getImpactVerdict()))
                    .collect(java.util.stream.Collectors.toList());
        }
        return ApiResponse.success(reports);
    }

    @GetMapping("/reports/{id}")
    @Operation(summary = "影响报告详情（变更+确认+实时爆炸半径）")
    public ApiResponse<Map<String, Object>> getReport(@PathVariable String id) {
        ChangeEventEntity change = changeService.getChange(id);
        Map<String, Object> report = new HashMap<>();
        report.put("change", change);
        report.put("acks", changeService.getAcks(id));
        report.put("liveImpact", impactAnalysisService.analyzeImpact(change.getAssetId()));
        return ApiResponse.success(report);
    }

    @PostMapping("/acks")
    @Operation(summary = "提交影响确认")
    public ApiResponse<ImpactAckEntity> acknowledge(@RequestBody ImpactAckEntity ack) {
        return ApiResponse.success(changeService.acknowledgeImpact(ack), "Impact acknowledged");
    }

    @PostMapping("/exemptions")
    @Operation(summary = "申请影响豁免")
    public ApiResponse<ImpactAckEntity> applyExemption(@RequestBody Map<String, String> request) {
        String ackId = request.get("ackId");
        String reason = request.get("reason");
        String untilStr = request.get("exemptUntil");
        LocalDateTime until = untilStr == null ? null : LocalDateTime.parse(untilStr);
        return ApiResponse.success(changeService.applyExemption(ackId, reason, until), "Exemption applied");
    }
}
