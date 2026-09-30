package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("asset_columns")
public class AssetColumnEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String assetId;
    private String name;
    private String type;
    private Boolean nullable;
    private String comment;
    private Boolean isPrimary;
    private Boolean isPii;
    private String sensitivity;
    private String sourceExpr;
    private String transformType;
    private LocalDateTime lastModified;
    private LocalDateTime createdAt;
}
