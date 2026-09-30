package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.AssetEntity;
import com.datalineage.entity.ChangeEventEntity;
import com.datalineage.entity.ImpactAckEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.AssetMapper;
import com.datalineage.mapper.ChangeEventMapper;
import com.datalineage.mapper.ImpactAckMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Change event governance service.
 * Handles change detection records, impact analysis results and audit workflow.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChangeService {

    private final ChangeEventMapper changeEventMapper;
    private final ImpactAckMapper impactAckMapper;
    private final AssetMapper assetMapper;
    private final ImpactAnalysisService impactAnalysisService;
    private final NotificationService notificationService;

    public List<ChangeEventEntity> listChanges(String status, Boolean isManaged, Boolean isBreaking) {
        QueryWrapper<ChangeEventEntity> wrapper = new QueryWrapper<>();
        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        if (isManaged != null) {
            wrapper.eq("is_managed", isManaged);
        }
        if (isBreaking != null) {
            wrapper.eq("is_breaking", isBreaking);
        }
        wrapper.orderByDesc("timestamp");
        return changeEventMapper.selectList(wrapper);
    }

    public ChangeEventEntity getChange(String id) {
        ChangeEventEntity change = changeEventMapper.selectById(id);
        if (change == null) {
            throw new BusinessException("Change event not found: " + id);
        }
        return change;
    }

    public List<ChangeEventEntity> getChangesByAsset(String assetId) {
        return changeEventMapper.findByAssetId(assetId);
    }

    /**
     * Record a new change event and trigger impact analysis.
     */
    @Transactional
    public ChangeEventEntity createChange(ChangeEventEntity change) {
        if (change.getAssetId() == null || change.getAssetId().isEmpty()) {
            throw new BusinessException("assetId is required when recording a change event");
        }
        // Resolve NOT NULL columns with sensible defaults
        if (change.getAssetName() == null || change.getAssetName().isEmpty()) {
            AssetEntity asset = assetMapper.selectById(change.getAssetId());
            change.setAssetName(asset != null ? asset.getName() : change.getAssetId());
        }
        if (change.getDetectedBy() == null || change.getDetectedBy().isEmpty()) {
            change.setDetectedBy("PROBE");
        }
        if (change.getTimestamp() == null) {
            change.setTimestamp(LocalDateTime.now());
        }
        if (change.getStatus() == null) {
            change.setStatus("DETECTED");
        }
        if (change.getIsManaged() == null) {
            change.setIsManaged(true);
        }
        if (change.getIsBreaking() == null) {
            change.setIsBreaking(false);
        }
        changeEventMapper.insert(change);

        // Run impact analysis automatically
        Map<String, Object> impact = impactAnalysisService.analyzeImpact(change.getAssetId());
        change.setImpactVerdict(String.valueOf(impact.getOrDefault("verdict", "SAFE")));
        change.setImpactSummary(String.valueOf(impact.getOrDefault("summary", "")));
        change.setAffectedMetrics((Integer) impact.getOrDefault("affectedMetrics", 0));
        change.setAffectedReports((Integer) impact.getOrDefault("affectedReports", 0));
        change.setAffectedApis((Integer) impact.getOrDefault("affectedApis", 0));
        change.setAffectedTables((Integer) impact.getOrDefault("affectedTables", 0));
        change.setStatus("ANALYZED");
        changeEventMapper.updateById(change);

        // Notify for breaking or unmanaged changes
        if (Boolean.TRUE.equals(change.getIsBreaking()) || Boolean.FALSE.equals(change.getIsManaged())) {
            notificationService.createNotification(
                    Boolean.TRUE.equals(change.getIsBreaking()) ? "HIGH" : "WARN",
                    "Schema change detected: " + change.getAssetName(),
                    change.getImpactSummary(),
                    "CHANGE_EVENT",
                    change.getId());
        }

        return changeEventMapper.selectById(change.getId());
    }

    @Transactional
    public ChangeEventEntity updateStatus(String id, String status, String actor) {
        ChangeEventEntity change = getChange(id);
        change.setStatus(status);
        if (actor != null) {
            change.setActor(actor);
        }
        changeEventMapper.updateById(change);
        return changeEventMapper.selectById(id);
    }

    @Transactional
    public void deleteChange(String id) {
        getChange(id);
        impactAckMapper.delete(new QueryWrapper<ImpactAckEntity>().eq("change_id", id));
        changeEventMapper.deleteById(id);
    }

    /**
     * Submit impact acknowledgment for an affected object.
     */
    @Transactional
    public ImpactAckEntity acknowledgeImpact(ImpactAckEntity ack) {
        getChange(ack.getChangeId());
        if (ack.getAckStatus() == null) {
            ack.setAckStatus("ACKED");
        }
        if ("ACKED".equals(ack.getAckStatus()) || "REJECTED".equals(ack.getAckStatus())) {
            ack.setAckedAt(java.time.LocalDateTime.now());
        }
        impactAckMapper.insert(ack);

        // Auto-resolve change when all acks are done
        List<ImpactAckEntity> acks = impactAckMapper.findByChangeId(ack.getChangeId());
        boolean allResolved = acks.stream().allMatch(a ->
                "ACKED".equals(a.getAckStatus()) || "REJECTED".equals(a.getAckStatus())
                        || "EXEMPTED".equals(a.getAckStatus()));
        if (allResolved) {
            updateStatus(ack.getChangeId(), "RESOLVED", null);
        } else {
            updateStatus(ack.getChangeId(), "ACK_PENDING", null);
        }
        return ack;
    }

    @Transactional
    public ImpactAckEntity applyExemption(String ackId, String reason, java.time.LocalDateTime until) {
        ImpactAckEntity ack = impactAckMapper.selectById(ackId);
        if (ack == null) {
            throw new BusinessException("Impact ack not found: " + ackId);
        }
        ack.setAckStatus("EXEMPTED");
        ack.setExemptReason(reason);
        ack.setExemptUntil(until);
        impactAckMapper.updateById(ack);
        return ack;
    }

    public List<ImpactAckEntity> getAcks(String changeId) {
        return impactAckMapper.findByChangeId(changeId);
    }

    public Map<String, Object> getChangeStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("total", changeEventMapper.selectCount(null));
        stats.put("pending", changeEventMapper.selectCount(
                new QueryWrapper<ChangeEventEntity>().ne("status", "RESOLVED")));
        stats.put("breaking", changeEventMapper.selectCount(
                new QueryWrapper<ChangeEventEntity>().eq("is_breaking", true)));
        stats.put("unmanaged", changeEventMapper.selectCount(
                new QueryWrapper<ChangeEventEntity>().eq("is_managed", false)));
        return stats;
    }
}
