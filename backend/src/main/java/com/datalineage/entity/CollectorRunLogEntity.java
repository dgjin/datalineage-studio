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
@TableName(value = "collector_run_logs", autoResultMap = true)
public class CollectorRunLogEntity {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String taskId;
    private String dataSourceId;
    private String runType;
    private String status;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Long durationMs;
    private Integer tablesScanned;
    private Integer columnsScanned;
    private Integer assetsCreated;
    private Integer assetsUpdated;
    private Integer edgesDiscovered;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> errors;
    /** Structured run detail: retry attempts, edges added/revived/retired. */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> detail;
    private String logText;
    private LocalDateTime createdAt;
}
