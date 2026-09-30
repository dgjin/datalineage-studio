package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.service.OpenLineageService;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * OpenLineage event ingestion - accepts run-time lineage events pushed by
 * Airflow / Spark / dbt / Flink producers (OpenLineage spec).
 */
@RestController
@RequestMapping("/openlineage")
@RequiredArgsConstructor
@Tag(name = "OpenLineage 事件摄入", description = "接收 OpenLineage 运行期血缘事件并写入血缘图")
public class OpenLineageController {

    private final OpenLineageService openLineageService;

    @PostMapping("/events")
    @Operation(summary = "接收 OpenLineage 事件")
    public ApiResponse<Map<String, Object>> ingest(@RequestBody JsonNode event) {
        return ApiResponse.success(openLineageService.ingest(event), "OpenLineage event ingested");
    }
}
