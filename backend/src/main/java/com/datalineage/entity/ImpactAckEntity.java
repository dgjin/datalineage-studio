package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("impact_acks")
public class ImpactAckEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String changeId;
    private String objectId;
    private String objectName;
    private String objectType;
    private Integer distance;
    private String via;
    private String owner;
    private String department;
    private String ackStatus;
    private String exemptReason;
    private LocalDateTime exemptUntil;
    private LocalDateTime ackedAt;
    private LocalDateTime createdAt;
}
