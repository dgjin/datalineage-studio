package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName(value = "notifications", autoResultMap = true)
public class NotificationEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String severity;
    private String title;
    private String body;
    private String refType;
    private String refId;
    @TableField("`read`")
    private Boolean read;
    private LocalDateTime timestamp;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> actions;
    private LocalDateTime createdAt;
}
