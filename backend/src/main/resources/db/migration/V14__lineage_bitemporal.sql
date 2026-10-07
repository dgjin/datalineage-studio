-- V14__lineage_bitemporal.sql
-- Bi-temporal lineage closure (evaluation report gap #10):
-- 1) lineage_edges.last_seen_at tracks the most recent collection run that reproduced
--    an auto-discovered edge; edges not re-seen within the retention window are
--    retired (valid_to set) with confidence decay instead of being physically deleted,
--    so time-travel replays still see the historical graph.
-- 2) collector_run_logs.detail stores structured change metadata (retry attempts and
--    edges added/revived/retired) so runs are auditable beyond the text summary.

ALTER TABLE lineage_edges
    ADD COLUMN last_seen_at DATETIME NULL COMMENT '最近一次被采集复现的时间' AFTER valid_to;

UPDATE lineage_edges SET last_seen_at = COALESCE(valid_to, valid_from) WHERE last_seen_at IS NULL;

ALTER TABLE lineage_edges ADD INDEX idx_last_seen (last_seen_at);

ALTER TABLE collector_run_logs
    ADD COLUMN detail JSON NULL COMMENT '结构化变更明细（attempts/edgesAdded/edgesRevived/edgesRetired）' AFTER errors;
