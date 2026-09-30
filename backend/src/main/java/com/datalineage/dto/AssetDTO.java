package com.datalineage.dto;

import lombok.Data;

import java.util.List;

@Data
public class AssetDTO {
    private String id;
    private String code;
    private String name;
    private String displayTitle;
    private String type;
    private String layer;
    private String space;
    private String owner;
    private String ownerEmail;
    private String department;
    private String status;
    private String description;
    private Integer confidence;
    private String sourceType;
    private Integer downstreamCount;
    private Integer upstreamCount;
    private Boolean isManaged;
    private List<String> tags;
    private String contractRef;
    private String storageFormat;
    private List<ColumnDTO> columns;
    private String createdAt;
    private String updatedAt;

    @Data
    public static class ColumnDTO {
        private String id;
        private String name;
        private String type;
        private Boolean nullable;
        private String comment;
        private Boolean isPrimary;
        private Boolean isPii;
        private String sensitivity;
        private String sourceExpr;
        private String transformType;
        private String lastModified;
    }
}
