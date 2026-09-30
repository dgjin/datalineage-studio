package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName(value = "change_events", autoResultMap = true)
public class ChangeEventEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String assetId;
    private String assetName;
    private String changeType;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private ChangeDetails details;
    private String detectedBy;
    private Boolean isBreaking;
    private Boolean isManaged;
    private String status;
    private String actor;
    private String traceId;
    private String mrUrl;
    private String impactVerdict;
    private String impactSummary;
    private Integer affectedMetrics;
    private Integer affectedReports;
    private Integer affectedApis;
    private Integer affectedTables;
    private LocalDateTime timestamp;
    private LocalDateTime createdAt;

    @Data
    public static class ChangeDetails {
        private String column;
        private String oldValue;
        private String newValue;
        private String rawDiff;
    }
}
