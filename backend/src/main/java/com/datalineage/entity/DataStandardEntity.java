package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("data_standards")
public class DataStandardEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String code;
    private String name;
    private String type;
    private String domain;
    private String ruleExpr;
    private String description;
    private String example;
    private String severity;
    private String status;
    private String version;
    private String owner;
    private Integer hitCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
