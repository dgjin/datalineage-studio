package com.datalineage.parser;

import lombok.Data;

/** Format-neutral design model column (extracted from ErMasterXmlParser inner class). */
@Data
public class ModelColumn {
    private String name;
    private String type;
    private Integer length;
    private Boolean nullable = true;
    private Boolean isPrimary = false;
    private String comment;

    /** Render type with length, e.g. varchar(64). */
    public String getFullType() {
        if (type == null) return "unknown";
        return length != null && length > 0 ? type + "(" + length + ")" : type;
    }
}
