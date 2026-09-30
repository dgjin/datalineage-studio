package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("validation_rules")
public class ValidationRuleEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String code;
    private String name;
    private String category;
    private String scope;
    private String expression;
    private String severity;
    private Boolean enabled;
    private String description;
    private String fixHint;
    private Integer hitCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
