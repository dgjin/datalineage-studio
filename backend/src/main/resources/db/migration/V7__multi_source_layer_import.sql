-- V7__multi_source_layer_import.sql
-- Multi-source layered import: asset source attribution + layer import relations

-- 1) 资产归属数据源（采集/自动注册时回填；手工资产为空）
ALTER TABLE assets
    ADD COLUMN data_source_id VARCHAR(64) NULL COMMENT '归属数据源（采集来源）' AFTER space,
    ADD INDEX idx_data_source (data_source_id);

-- 2) 采集任务增加层过滤（可选，空 = 全量；用于单源多层场景限定注册范围）
ALTER TABLE metadata_collect_tasks
    ADD COLUMN target_layers JSON NULL COMMENT '目标层白名单（可选，空=全部）' AFTER target_tables;

-- 3) 层间导入关系表：登记 ODS->DWD / ODS->DWS / ODS->ADS / ODS->APP 等跨源数据流
CREATE TABLE IF NOT EXISTS layer_import_relations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL COMMENT '关系名称，如 ODS源库->DWD明细仓',
    from_layer ENUM('ODS','DWD','DWS','ADS','APP') NOT NULL,
    to_layer ENUM('ODS','DWD','DWS','ADS','APP') NOT NULL,
    from_data_source_id VARCHAR(64) NOT NULL,
    to_data_source_id VARCHAR(64) NOT NULL,
    match_mode ENUM('OBJECT_NAME','ETL_SQL') NOT NULL DEFAULT 'OBJECT_NAME',
    etl_sql TEXT NULL COMMENT 'ETL_SQL 模式：INSERT INTO ... SELECT ... 语句（可多条，; 分隔）',
    status ENUM('ACTIVE','PAUSED') DEFAULT 'ACTIVE',
    last_build_at DATETIME,
    last_build_result VARCHAR(256) COMMENT '构建结果摘要',
    edges_built INT DEFAULT 0 COMMENT '最近一次构建产出的边数',
    created_by VARCHAR(128),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_from (from_data_source_id, from_layer),
    INDEX idx_to (to_data_source_id, to_layer)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='层间导入关系表';

-- 4) 血缘边来源扩展：CROSS_SOURCE（关系登记同名匹配）/ ETL_PARSER（ETL SQL 解析）
ALTER TABLE lineage_edges
    MODIFY COLUMN source ENUM('CONTRACT','OPENLINEAGE','PARSER','PROBE','JDBC_FK','VIEW_DEP','CROSS_SOURCE','ETL_PARSER') NOT NULL;
