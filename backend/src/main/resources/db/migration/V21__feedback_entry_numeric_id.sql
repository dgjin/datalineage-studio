-- V21__feedback_entry_numeric_id.sql
-- 需求反馈条目 ID 由 UUID 字符串改为自然数自增编号（对齐源实现契约 id: 'number 条目编号'）：
-- 1) 清空两类表数据（存量 UUID 主键无法数值化；功能尚未正式启用，仅含联测数据）
-- 2) feedback_entries.id 改 BIGINT AUTO_INCREMENT 主键（清空后从 1 起编）
-- 3) feedback_entry_revisions.entry_id 同步改 BIGINT 并重建外键

DELETE FROM feedback_entry_revisions;
DELETE FROM feedback_entries;

ALTER TABLE feedback_entry_revisions DROP FOREIGN KEY fk_feedback_rev_entry;
ALTER TABLE feedback_entries DROP PRIMARY KEY;
ALTER TABLE feedback_entries
    MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT COMMENT '条目编号（自增自然数）',
    ADD PRIMARY KEY (id);
ALTER TABLE feedback_entry_revisions
    MODIFY COLUMN entry_id BIGINT NOT NULL COMMENT '所属条目编号';
ALTER TABLE feedback_entry_revisions
    ADD CONSTRAINT fk_feedback_rev_entry FOREIGN KEY (entry_id) REFERENCES feedback_entries (id) ON DELETE CASCADE;
