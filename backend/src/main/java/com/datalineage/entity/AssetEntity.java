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
@TableName(value = "assets", autoResultMap = true)
public class AssetEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String code;
    private String name;
    private String displayTitle;
    private String type;
    private String layer;
    private String space;
    private String owner;
    private String ownerEmail;
    private String department;
    private String status;
    private String description;
    private Integer confidence;
    private String sourceType;
    private Integer downstreamCount;
    private Integer upstreamCount;
    private Boolean isManaged;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> tags;
    private String contractRef;
    private String storageFormat;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
