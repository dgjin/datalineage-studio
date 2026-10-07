package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** One audited write operation, captured by AuditLogAspect around controllers. */
@Data
@TableName("audit_logs")
public class AuditLogEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String username;
    private String role;
    private String httpMethod;
    private String path;
    private String action;
    private String resourceType;
    private String resourceId;
    private String summary;
    private String result;
    private Long durationMs;
    private String clientIp;
    private LocalDateTime createdAt;
}
