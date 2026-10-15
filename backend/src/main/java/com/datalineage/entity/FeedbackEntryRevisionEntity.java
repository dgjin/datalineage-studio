package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 需求反馈评估历史：每次评估（含「继续评估」）追加一条。
 * 主表只存最新结论；导出接口按条目附带 revisions 数组（评估顺序升序，至多 20 条），
 * 「继续评估」产生的新内容经此提供给 AIOps 同步分析基线。
 */
@Data
@TableName("feedback_entry_revisions")
public class FeedbackEntryRevisionEntity {
    /** 自增主键：升序即评估先后（对齐源实现 ORDER BY id ASC） */
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long entryId;
    private String action;
    private String priority;
    private String baselineVersion;
    private String assessment;
    private String reviewer;
    private LocalDateTime createdAt;
}
