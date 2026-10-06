-- V8__data_model_baseline.sql
-- Data model baseline: import ERMaster .erm design models, diff against live ODS, evaluate downstream impact

-- 1) 数据模型主表：一次导入产生一条记录（设计基线快照）
CREATE TABLE IF NOT EXISTS data_models (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL COMMENT '模型名称，如 客户域开发版v2.3',
    version VARCHAR(16) DEFAULT 'v1.0',
    source_format ENUM('ERMASTER_XML') DEFAULT 'ERMASTER_XML',
    file_name VARCHAR(256) COMMENT '原始上传文件名',
    target_layer ENUM('ODS','DWD','DWS','ADS','APP') DEFAULT 'ODS' COMMENT '模型目标分层（对比基准层）',
    target_data_source_id VARCHAR(64) COMMENT '对比目标数据源',
    status ENUM('DRAFT','BASELINE','ARCHIVED') DEFAULT 'DRAFT',
    table_count INT DEFAULT 0,
    column_count INT DEFAULT 0,
    raw_xml MEDIUMTEXT COMMENT '原始 XML 存档',
    created_by VARCHAR(128),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_target (target_data_source_id, target_layer)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据模型主表（设计基线）';

-- 2) 模型表结构明细：每张模型表一行，字段与关系以 JSON 存储
CREATE TABLE IF NOT EXISTS data_model_tables (
    id VARCHAR(64) PRIMARY KEY,
    model_id VARCHAR(64) NOT NULL,
    table_name VARCHAR(128) NOT NULL,
    table_comment VARCHAR(512),
    columns JSON COMMENT '字段数组：[{name,type,nullable,isPrimary,comment}]',
    relations JSON COMMENT '表间关系：[{fromTable,fromCol,toTable,toCol}]',
    FOREIGN KEY (model_id) REFERENCES data_models(id) ON DELETE CASCADE,
    INDEX idx_model (model_id),
    INDEX idx_table_name (table_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据模型表结构明细';
