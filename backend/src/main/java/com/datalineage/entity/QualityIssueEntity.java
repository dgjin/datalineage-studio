package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("quality_issues")
public class QualityIssueEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String code;
    private String title;
    private String description;
    private String issueType;
    private String ownerDept;
    private String status;
    private String priority;
    private String affectedAssetId;
    private String affectedAssetName;
    private String createdBy;
    private LocalDate dueDate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
