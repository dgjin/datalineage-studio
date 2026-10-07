package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** One archived import of a design model (raw file + counts), ordered by version_no. */
@Data
@TableName(value = "data_model_versions", autoResultMap = true)
public class DataModelVersionEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String modelId;
    private Integer versionNo;
    private String versionLabel;
    private String fileName;
    private String rawXml;
    private Integer tableCount;
    private Integer columnCount;
    private String importedBy;
    private LocalDateTime createdAt;
}
