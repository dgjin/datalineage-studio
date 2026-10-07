package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.ApprovalRecordEntity;
import com.datalineage.entity.ChangeEventEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.ApprovalRecordMapper;
import com.datalineage.mapper.ChangeEventMapper;
import com.datalineage.metrics.GovernanceMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Publish-gate approval workflow.
 * BLOCKER/HIGH managed changes are routed to APPROVAL_PENDING automatically;
 * an approver must approve before the change is considered released, or reject
 * to block the release. Every decision is recorded for audit.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalService {

    private final ChangeEventMapper changeEventMapper;
    private final ApprovalRecordMapper approvalRecordMapper;
    private final NotificationService notificationService;
    private final GovernanceMetrics governanceMetrics;
    private final WebhookService webhookService;

    /**
     * Auto-trigger the approval gate for high-risk managed changes.
     * Called right after impact analysis finishes.
     */
    @Transactional
    public boolean autoTriggerIfHighRisk(ChangeEventEntity change) {
        String verdict = change.getImpactVerdict();
        boolean highRisk = "BLOCKER".equals(verdict) || "HIGH".equals(verdict);
        if (!highRisk || Boolean.FALSE.equals(change.getIsManaged())) {
            return false;
        }
        change.setStatus("APPROVAL_PENDING");
        changeEventMapper.updateById(change);

        ApprovalRecordEntity record = new ApprovalRecordEntity();
        record.setChangeId(change.getId());
        record.setAction("SUBMIT");
        record.setActor("自动门禁");
        record.setComment("影响面评估为 " + verdict + "，自动提交发布审批");
        record.setDecidedAt(LocalDateTime.now());
        approvalRecordMapper.insert(record);

        notificationService.createNotification(
                "BLOCKER".equals(verdict) ? "CRITICAL" : "HIGH",
                "变更待审批：" + change.getAssetName(),
                change.getImpactSummary(),
                "CHANGE_EVENT",
                change.getId());
        return true;
    }

    /** Manual submission for changes that were analyzed but not auto-gated. */
    @Transactional
    public ChangeEventEntity submitForApproval(String changeId, String actor, String comment) {
        ChangeEventEntity change = getChange(changeId);
        if (!List.of("DETECTED", "ANALYZED", "ACK_PENDING").contains(change.getStatus())) {
            throw new BusinessException("当前状态不可提交审批: " + change.getStatus());
        }
        change.setStatus("APPROVAL_PENDING");
        changeEventMapper.updateById(change);

        ApprovalRecordEntity record = new ApprovalRecordEntity();
        record.setChangeId(changeId);
        record.setAction("SUBMIT");
        record.setActor(actor == null ? "手动提交" : actor);
        record.setComment(comment);
        record.setDecidedAt(LocalDateTime.now());
        approvalRecordMapper.insert(record);
        return changeEventMapper.selectById(changeId);
    }

    @Transactional
    public ChangeEventEntity approve(String changeId, String actor, String comment) {
        return decide(changeId, "APPROVE", "APPROVED", actor, comment);
    }

    @Transactional
    public ChangeEventEntity reject(String changeId, String actor, String comment) {
        return decide(changeId, "REJECT", "REJECTED", actor, comment);
    }

    private ChangeEventEntity decide(String changeId, String action, String targetStatus,
                                     String actor, String comment) {
        ChangeEventEntity change = getChange(changeId);
        if (!"APPROVAL_PENDING".equals(change.getStatus())) {
            throw new BusinessException("仅待审批状态的变更可以决策，当前: " + change.getStatus());
        }
        change.setStatus(targetStatus);
        if (actor != null) {
            change.setActor(actor);
        }
        changeEventMapper.updateById(change);

        ApprovalRecordEntity record = new ApprovalRecordEntity();
        record.setChangeId(changeId);
        record.setAction(action);
        record.setActor(actor);
        record.setComment(comment);
        record.setDecidedAt(LocalDateTime.now());
        approvalRecordMapper.insert(record);
        governanceMetrics.recordApprovalDecision(action, change.getCreatedAt());

        boolean approved = "APPROVE".equals(action);
        notificationService.createNotification(
                approved ? "INFO" : "HIGH",
                (approved ? "变更已批准发布：" : "变更已驳回：") + change.getAssetName(),
                comment == null || comment.isBlank()
                        ? (approved ? "审批通过，变更可进入发布流程" : "审批驳回，变更被阻断")
                        : comment,
                "CHANGE_EVENT",
                changeId);

        // Push the decision to external subscribers (CI/CD webhooks).
        Map<String, Object> webhookPayload = new LinkedHashMap<>();
        webhookPayload.put("changeId", changeId);
        webhookPayload.put("assetName", change.getAssetName());
        webhookPayload.put("action", action);
        webhookPayload.put("actor", actor);
        webhookPayload.put("status", targetStatus);
        webhookPayload.put("comment", comment);
        webhookPayload.put("decidedAt", LocalDateTime.now().toString());
        webhookService.publish(WebhookService.EVENT_APPROVAL_DECIDED, webhookPayload);

        return changeEventMapper.selectById(changeId);
    }

    public List<ChangeEventEntity> listPending() {
        QueryWrapper<ChangeEventEntity> wrapper = new QueryWrapper<>();
        wrapper.eq("status", "APPROVAL_PENDING").orderByDesc("timestamp");
        return changeEventMapper.selectList(wrapper);
    }

    public List<ApprovalRecordEntity> getRecords(String changeId) {
        return approvalRecordMapper.selectList(new QueryWrapper<ApprovalRecordEntity>()
                .eq("change_id", changeId).orderByAsc("created_at"));
    }

    /** Recent approval decisions with the underlying change for the audit trail view. */
    public List<Map<String, Object>> listRecentDecisions(int limit) {
        List<ApprovalRecordEntity> records = approvalRecordMapper.selectList(
                new QueryWrapper<ApprovalRecordEntity>()
                        .isNotNull("decided_at")
                        .orderByDesc("decided_at")
                        .last("LIMIT " + Math.max(1, Math.min(limit, 100))));
        return records.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("changeId", r.getChangeId());
            m.put("action", r.getAction());
            m.put("actor", r.getActor());
            m.put("comment", r.getComment());
            m.put("decidedAt", r.getDecidedAt());
            ChangeEventEntity change = changeEventMapper.selectById(r.getChangeId());
            if (change != null) {
                m.put("assetName", change.getAssetName());
                m.put("changeType", change.getChangeType());
                m.put("impactVerdict", change.getImpactVerdict());
                m.put("changeStatus", change.getStatus());
            }
            return m;
        }).toList();
    }

    private ChangeEventEntity getChange(String id) {
        ChangeEventEntity change = changeEventMapper.selectById(id);
        if (change == null) {
            throw new BusinessException("Change event not found: " + id);
        }
        return change;
    }
}
