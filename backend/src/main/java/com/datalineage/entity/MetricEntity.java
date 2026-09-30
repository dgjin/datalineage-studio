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
@TableName(value = "metrics", autoResultMap = true)
public class MetricEntity {
    @TableId(type = IdType.INPUT)
    private String code;
    private String name;
    private String type;
    private String caliberSummary;
    private String entity;
    private String measureExpr;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> filterConditions;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> dimensions;
    private String unit;
    private String calcType;
    private String frequency;
    private String caliberSystem;
    private String owner;
    private String status;
    private String version;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> upstreamMetrics;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<ReferencedColumn> referencedColumns;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> downstreamReports;
    private LocalDateTime lastModified;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    public static class ReferencedColumn {
        private String assetId;
        private String assetName;
        private String columnName;
        private Integer confidence;
    }
}
