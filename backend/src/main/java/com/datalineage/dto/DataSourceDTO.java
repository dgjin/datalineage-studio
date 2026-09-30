package com.datalineage.dto;

import lombok.Data;

@Data
public class DataSourceDTO {
    private String id;
    private String name;
    private String type;
    private String host;
    private Integer port;
    private String databaseName;
    private String username;
    private String password;
    private String connectionParams;
    private Boolean sslEnabled;
    private String status;
    private String lastTestAt;
    private String lastTestResult;
    private String testErrorMsg;
    private String createdBy;
    private String createdAt;
    private String updatedAt;
}
