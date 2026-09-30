package com.datalineage.collector;

/**
 * Resolves warehouse layers (ODS / DWD / DWS / ADS / APP) from object naming conventions.
 *
 * <p>Objects following the layer-prefix convention (ods_, dwd_, dws_, ads_, app_) are routed
 * to the matching layer so a single collection task can register assets across the whole
 * warehouse stack. Objects without a recognized prefix fall back to the task's default layer,
 * keeping the previous single-layer behavior for unmanaged/legacy schemas.
 */
public final class LayerResolver {

    private LayerResolver() {
    }

    public static String resolve(String objectName, String fallbackLayer) {
        if (objectName != null) {
            String lower = objectName.toLowerCase();
            if (lower.startsWith("ods_")) return "ODS";
            if (lower.startsWith("dwd_")) return "DWD";
            if (lower.startsWith("dws_")) return "DWS";
            if (lower.startsWith("ads_")) return "ADS";
            if (lower.startsWith("app_")) return "APP";
        }
        return (fallbackLayer != null && !fallbackLayer.isEmpty()) ? fallbackLayer : "ODS";
    }
}
