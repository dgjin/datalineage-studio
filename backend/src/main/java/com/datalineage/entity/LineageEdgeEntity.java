package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("lineage_edges")
public class LineageEdgeEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String fromAssetId;
    private String toAssetId;
    private String fromColumn;
    private String toColumn;
    private String kind;
    private String source;
    private Integer confidence;
    private String transformExpr;
    private Boolean isCriticalPath;
    private LocalDateTime validFrom;
    private LocalDateTime validTo;
    private LocalDateTime createdAt;
}
