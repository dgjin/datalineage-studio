package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * A declared layer-to-layer data flow across two data sources, e.g.
 * "ODS 源库 -> DWD 明细仓". Building a relation generates lineage edges
 * (TABLE/COLUMN) that are tagged with transform_expr "relation:{id}" so they
 * can be rebuilt or removed without touching manual/contract edges.
 */
@Data
@TableName("layer_import_relations")
public class LayerImportRelationEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String name;
    private String fromLayer;
    private String toLayer;
    private String fromDataSourceId;
    private String toDataSourceId;
    /** OBJECT_NAME = business-name auto match; ETL_SQL = parse registered INSERT..SELECT statements */
    private String matchMode;
    private String etlSql;
    private String status;
    private LocalDateTime lastBuildAt;
    private String lastBuildResult;
    private Integer edgesBuilt;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
