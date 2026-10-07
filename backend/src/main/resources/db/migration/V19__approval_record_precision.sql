-- V19__approval_record_precision.sql
-- 闭环验证 3B.5 发现：submit 与 approve 在同一秒内完成时，
-- approval_records.created_at 为秒级 DATETIME，ORDER BY created_at 顺序不稳定，
-- 审批流水时间线不可靠。升级到毫秒精度（应用层 LocalDateTime.now 已带毫秒）。

ALTER TABLE approval_records
    MODIFY COLUMN decided_at DATETIME(3) COMMENT '决策时间（毫秒精度）',
    MODIFY COLUMN created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3);
