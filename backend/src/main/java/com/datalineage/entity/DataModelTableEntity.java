package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@TableName(value = "data_model_tables", autoResultMap = true)
public class DataModelTableEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String modelId;
    private String tableName;
    private String tableComment;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> columns;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> relations;
}
