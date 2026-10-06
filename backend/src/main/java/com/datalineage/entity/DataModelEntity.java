package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("data_models")
public class DataModelEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String name;
    private String version;
    private String sourceFormat;
    private String fileName;
    private String targetLayer;
    private String targetDataSourceId;
    private String status;
    private Integer tableCount;
    private Integer columnCount;
    private String rawXml;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
