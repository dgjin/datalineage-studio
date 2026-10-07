package com.datalineage.parser;

import lombok.Data;

import java.util.List;
import java.util.Map;

/** Format-neutral design model table (extracted from ErMasterXmlParser inner class). */
@Data
public class ModelTable {
    private String tableName;
    private String tableComment;
    private List<ModelColumn> columns;
    private List<Map<String, String>> relations;
}
