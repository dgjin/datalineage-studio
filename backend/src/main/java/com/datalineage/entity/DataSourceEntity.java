package com.datalineage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("data_sources")
public class DataSourceEntity {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String name;
    private String type;
    private String host;
    private Integer port;
    private String databaseName;
    private String username;
    private String passwordEncrypted;
    private String connectionParams;
    private Boolean sslEnabled;
    private String status;
    private LocalDateTime lastTestAt;
    private String lastTestResult;
    private String testErrorMsg;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
