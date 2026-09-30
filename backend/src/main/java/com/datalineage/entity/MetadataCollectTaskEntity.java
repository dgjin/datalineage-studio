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
@TableName(value = "metadata_collect_tasks", autoResultMap = true)
public class MetadataCollectTaskEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String dataSourceId;
    private String taskName;
    private String collectScope;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> targetSchemas;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> targetTables;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> targetLayers;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> excludeTables;
    private String scheduleCron;
    private Boolean autoRegisterAsset;
    private Boolean autoDiscoverLineage;
    private String defaultOwner;
    private String defaultLayer;
    private String defaultSpace;
    private String status;
    private LocalDateTime lastRunAt;
    private Long lastRunDuration;
    private String lastRunResult;
    @TableField(updateStrategy = com.baomidou.mybatisplus.annotation.FieldStrategy.ALWAYS)
    private String lastErrorMsg;
    private Integer totalTablesFound;
    private Integer totalColumnsFound;
    private Integer newAssetsRegistered;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
