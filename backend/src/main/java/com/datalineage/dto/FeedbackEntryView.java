package com.datalineage.dto;

import com.datalineage.entity.FeedbackEntryEntity;
import lombok.Data;

import java.util.List;

/**
 * 需求反馈条目视图（我的列表 / 管理列表 / 标准导出接口共用同一映射，字段命名保持稳定；
 * 契约 v1.0 字段：id / kind / title / content / status / priority / baselineVersion /
 * assessment / submitter / department / reviewer / reviewedAt / createdAt / updatedAt）。
 */
@Data
public class FeedbackEntryView {
    /** 条目编号（自然数自增，与契约 v1.0 'number 条目编号' 一致） */
    private Long id;
    private String kind;
    private String title;
    private String content;
    private String status;
    private String priority;
    private String baselineVersion;
    private String assessment;
    private String submitter;
    private String department;
    private String reviewer;
    private String reviewedAt;
    private String createdAt;
    private String updatedAt;
    /** 评估历史（管理列表与导出接口附带；时间升序，至多 20 条） */
    private List<FeedbackRevisionView> revisions;

    public static FeedbackEntryView from(FeedbackEntryEntity entity) {
        FeedbackEntryView view = new FeedbackEntryView();
        view.setId(entity.getId());
        view.setKind(entity.getKind());
        view.setTitle(entity.getTitle());
        view.setContent(entity.getContent());
        view.setStatus(entity.getStatus());
        view.setPriority(entity.getPriority() == null ? "" : entity.getPriority());
        view.setBaselineVersion(entity.getBaselineVersion() == null ? "" : entity.getBaselineVersion());
        view.setAssessment(entity.getAssessment() == null ? "" : entity.getAssessment());
        view.setSubmitter(entity.getSubmitter());
        view.setDepartment(entity.getDepartment() == null ? "" : entity.getDepartment());
        view.setReviewer(entity.getReviewer() == null ? "" : entity.getReviewer());
        view.setReviewedAt(IsoTime.iso(entity.getReviewedAt()));
        view.setCreatedAt(IsoTime.iso(entity.getCreatedAt()));
        view.setUpdatedAt(IsoTime.iso(entity.getUpdatedAt()));
        return view;
    }
}
