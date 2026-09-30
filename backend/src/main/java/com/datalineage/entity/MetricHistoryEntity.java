package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("metric_history")
public class MetricHistoryEntity {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String metricCode;
    private String version;
    private String diff;
    private Boolean breakingHistoryData;
    private LocalDateTime createdAt;
}
