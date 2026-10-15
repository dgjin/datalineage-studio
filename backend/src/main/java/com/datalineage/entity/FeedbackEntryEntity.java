package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 需求反馈条目：用户提交的需求 / 建议 / 缺陷 + 管理员最新评估结论。
 * 状态流转 PENDING → BASELINED / REJECTED；每次评估的历史留痕见
 * {@link FeedbackEntryRevisionEntity}（导出的 revisions 字段数据源）。
 */
@Data
@TableName("feedback_entries")
public class FeedbackEntryEntity {
    /** 自然数自增编号（对齐源实现契约 id: 'number 条目编号'） */
    @TableId(type = IdType.AUTO)
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
    private LocalDateTime reviewedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
