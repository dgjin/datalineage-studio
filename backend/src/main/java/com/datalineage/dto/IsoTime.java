package com.datalineage.dto;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * 需求反馈契约的时间格式化：LocalDateTime → ISO 8601（带 +08:00 偏移）。
 * 契约 v1.0 要求 ISO 8601；本类输出的格式也能被服务端 since 解析器原样回传
 * （增量拉取「导出时点 → since」闭环）。
 */
public final class IsoTime {

    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

    private IsoTime() {
    }

    /** 空值保持 null（reviewedAt 未评估时为 null）。 */
    public static String iso(LocalDateTime time) {
        return time == null ? null : time.atZone(ZONE).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }

    /** 当前时点（exportedAt）。 */
    public static String nowIso() {
        return LocalDateTime.now().atZone(ZONE).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }
}
