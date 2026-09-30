package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("contracts")
public class ContractEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String path;
    private String domain;
    private String version;
    private String author;
    private String status;
    private String yamlContent;
    private String generatedDdl;
    private LocalDateTime lastUpdated;
    private LocalDateTime createdAt;
}
