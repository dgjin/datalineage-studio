package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("approval_records")
public class ApprovalRecordEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String changeId;
    private String action;
    private String actor;
    private String comment;
    private LocalDateTime decidedAt;
    private LocalDateTime createdAt;
}
