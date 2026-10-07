-- V18__manual_source_enum.sql
-- 闭环验证发现的缺口修复：
-- 1) assets.source_type 无 'MANUAL' 值，API/人工注册资产（POST /assets 不带来源）
--    插入时 Field 'source_type' doesn't have a default value 直接 500；
-- 2) change_events.detected_by 缺 'MANUAL'，M3 影响分析「计划性变更」闭环
--    使用非枚举值导致 Data truncated 500，人工登记的变更没有合法来源值。
-- 扩展两个来源枚举，人工/API 入口统一使用 MANUAL。

ALTER TABLE assets
    MODIFY COLUMN source_type ENUM('CONTRACT','OPENLINEAGE','JDBC_SCHEMA','SQL_PARSER','CDC_PROBE','MANUAL') NOT NULL;

ALTER TABLE change_events
    MODIFY COLUMN detected_by ENUM('CI_CONTRACT','CDC','PROBE','OPENLINEAGE','MANUAL') NOT NULL;
