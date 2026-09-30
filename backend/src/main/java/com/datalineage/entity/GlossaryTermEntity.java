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
@TableName("glossary_terms")
public class GlossaryTermEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String term;
    private String abbr;
    private String category;
    private String domain;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> synonyms;
    private String definition;
    private String status;
    private String version;
    private String owner;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
