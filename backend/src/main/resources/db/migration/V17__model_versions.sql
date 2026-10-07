-- V17__model_versions.sql
-- M13 model enhancement: version history + PowerDesigner .pdm format support

-- 1) 扩展 source_format 枚举，支持 PowerDesigner 物理模型
ALTER TABLE data_models
    MODIFY COLUMN source_format ENUM('ERMASTER_XML','PD_PDM') DEFAULT 'ERMASTER_XML';

-- 2) 模型版本历史：同名模型每次导入递增版本号并归档原始文件
CREATE TABLE IF NOT EXISTS data_model_versions (
    id VARCHAR(64) PRIMARY KEY,
    model_id VARCHAR(64) NOT NULL,
    version_no INT NOT NULL COMMENT '版本序号，从 1 递增',
    version_label VARCHAR(32) COMMENT '版本标签，如 v1.0',
    file_name VARCHAR(256) COMMENT '导入时的原始文件名',
    raw_xml MEDIUMTEXT COMMENT '原始文件存档（供版本对比与表明细回放）',
    table_count INT DEFAULT 0,
    column_count INT DEFAULT 0,
    imported_by VARCHAR(128),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES data_models(id) ON DELETE CASCADE,
    UNIQUE KEY uk_model_version (model_id, version_no),
    INDEX idx_model_created (model_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据模型版本历史';

-- 3) 回填现有模型为 v1 版本记录，保证版本链连续
INSERT INTO data_model_versions
    (id, model_id, version_no, version_label, file_name, raw_xml, table_count, column_count, imported_by, created_at)
SELECT REPLACE(UUID(), '-', ''), id, 1, COALESCE(NULLIF(version, ''), 'v1.0'), file_name, raw_xml,
       COALESCE(table_count, 0), COALESCE(column_count, 0), created_by, COALESCE(created_at, NOW())
FROM data_models;
