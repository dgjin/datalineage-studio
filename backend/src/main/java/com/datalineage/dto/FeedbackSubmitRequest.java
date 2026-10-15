package com.datalineage.dto;

import lombok.Data;

/**
 * 提交需求反馈请求体：kind / title / content 校验语义与统一（管理面板录入复用同一接口，
 * body 支持可选 priority P0-P3，随提交一并入库）。
 */
@Data
public class FeedbackSubmitRequest {
    private String kind;
    private String title;
    private String content;
    private String priority;
}
