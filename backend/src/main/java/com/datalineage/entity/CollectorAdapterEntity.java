package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName(value = "collector_adapters", autoResultMap = true)
public class CollectorAdapterEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String name;
    private String type;
    private String mode;
    private String status;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> capabilities;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> config;
    private LocalDateTime lastRunTime;
    private Integer totalAssetsDiscovered;
    // Column is changes_captured_24h: the digit breaks the default camel->snake
    // mapping (which would produce changes_captured24h) and used to 500 the list API.
    @TableField("changes_captured_24h")
    private Integer changesCaptured24h;
    private String avgLatency;
    private Integer healthScore;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
