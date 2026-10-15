package com.datalineage.dto;

import lombok.Data;

/**
 * 评估分析请求体：action（BASELINE 纳入基线 / REJECT 不予采纳 / PENDING 退回待评估）
 * + 可选 priority / baselineVersion / assessment。
 */
@Data
public class FeedbackReviewRequest {
    private String action;
    private String priority;
    private String baselineVersion;
    private String assessment;
}
