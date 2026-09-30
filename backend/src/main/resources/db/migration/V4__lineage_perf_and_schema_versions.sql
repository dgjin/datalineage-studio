-- V4__lineage_perf_and_schema_versions.sql
-- 1) Composite indexes for lineage traversal (from/to + kind) so subgraph and
--    impact queries stop relying on full-table scans at scale.
ALTER TABLE lineage_edges
    ADD INDEX idx_from_kind (from_asset_id, kind),
    ADD INDEX idx_to_kind (to_asset_id, kind);

-- 2) Schema version snapshots: one row per structural change, supplies
--    time-travel queries ("what did this table look like at time T").
CREATE TABLE IF NOT EXISTS asset_schema_versions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    asset_id VARCHAR(64) NOT NULL COMMENT '资产ID',
    version INT NOT NULL COMMENT '版本号，从 1 递增',
    snapshot_json MEDIUMTEXT NOT NULL COMMENT '列结构快照（canonical JSON）',
    diff_json TEXT COMMENT '相对上一版本的差异（added/removed/changed）',
    captured_at DATETIME NOT NULL COMMENT '采集时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_asset_version (asset_id, version),
    INDEX idx_asset_captured (asset_id, captured_at),
    CONSTRAINT fk_schema_ver_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产结构版本快照表';
