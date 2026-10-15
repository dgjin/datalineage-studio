package com.datalineage.dto;

import com.datalineage.entity.FeedbackEntryRevisionEntity;
import lombok.Data;

/**
 * 评估历史视图（管理列表与标准导出接口共用；字段命名与契约 v1.0 保持一致）。
 */
@Data
public class FeedbackRevisionView {
    private Long id;
    private String entryId;
    private String action;
    private String priority;
    private String baselineVersion;
    private String assessment;
    private String reviewer;
    private String createdAt;

    public static FeedbackRevisionView from(FeedbackEntryRevisionEntity entity) {
        FeedbackRevisionView view = new FeedbackRevisionView();
        view.setId(entity.getId());
        view.setEntryId(entity.getEntryId());
        view.setAction(entity.getAction());
        view.setPriority(entity.getPriority() == null ? "" : entity.getPriority());
        view.setBaselineVersion(entity.getBaselineVersion() == null ? "" : entity.getBaselineVersion());
        view.setAssessment(entity.getAssessment() == null ? "" : entity.getAssessment());
        view.setReviewer(entity.getReviewer() == null ? "" : entity.getReviewer());
        view.setCreatedAt(IsoTime.iso(entity.getCreatedAt()));
        return view;
    }
}
