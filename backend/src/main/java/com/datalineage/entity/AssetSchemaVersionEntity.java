package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("asset_schema_versions")
public class AssetSchemaVersionEntity {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String assetId;
    private Integer version;
    private String snapshotJson;
    private String diffJson;
    private LocalDateTime capturedAt;
    private LocalDateTime createdAt;
}
