package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/** Outbound webhook subscription: which events get pushed to which URL. */
@Data
@TableName(value = "webhook_configs", autoResultMap = true)
public class WebhookConfigEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String name;
    private String url;
    /** Subscribed event names, e.g. change.created / approval.decided / standard.violation. */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> events;
    private Boolean enabled;
    private String secret;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
