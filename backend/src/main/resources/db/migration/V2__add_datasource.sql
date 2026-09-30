-- V2__add_datasource.sql
-- Data Source Management and Metadata Collection Schema

-- 数据源配置表
CREATE TABLE IF NOT EXISTS data_sources (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL COMMENT '数据源名称',
    type ENUM('MYSQL','POSTGRESQL','ORACLE','SQLSERVER','HIVE','CLICKHOUSE','KAFKA') NOT NULL,
    host VARCHAR(256) NOT NULL,
    port INT NOT NULL,
    database_name VARCHAR(128) NOT NULL,
    username VARCHAR(128) NOT NULL,
    password_encrypted VARCHAR(512) COMMENT '加密存储的密码',
    connection_params JSON COMMENT '额外连接参数',
    ssl_enabled BOOLEAN DEFAULT FALSE,
    status ENUM('ACTIVE','INACTIVE','ERROR') DEFAULT 'ACTIVE',
    last_test_at DATETIME COMMENT '最后测试时间',
    last_test_result ENUM('SUCCESS','FAILED') COMMENT '最后测试结果',
    test_error_msg TEXT COMMENT '测试错误信息',
    created_by VARCHAR(128),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据源配置表';

-- 元数据采集任务表
CREATE TABLE IF NOT EXISTS metadata_collect_tasks (
    id VARCHAR(64) PRIMARY KEY,
    data_source_id VARCHAR(64) NOT NULL,
    task_name VARCHAR(128) NOT NULL,
    collect_scope ENUM('FULL','INCREMENTAL','SCHEMA_ONLY') DEFAULT 'SCHEMA_ONLY',
    target_schemas JSON COMMENT '目标 schema 列表',
    target_tables JSON COMMENT '目标表白名单（可选）',
    exclude_tables JSON COMMENT '排除表黑名单（可选）',
    schedule_cron VARCHAR(64) COMMENT '定时表达式，如 0 0 2 * * ?',
    auto_register_asset BOOLEAN DEFAULT FALSE COMMENT '是否自动注册为资产',
    auto_discover_lineage BOOLEAN DEFAULT FALSE COMMENT '是否自动发现血缘',
    default_owner VARCHAR(128) COMMENT '默认负责人',
    default_layer ENUM('ODS','DWD','DWS','ADS','APP') DEFAULT 'ODS',
    default_space VARCHAR(32) DEFAULT 'default',
    status ENUM('PENDING','RUNNING','SUCCESS','FAILED','PAUSED') DEFAULT 'PENDING',
    last_run_at DATETIME,
    last_run_duration BIGINT COMMENT '最后运行耗时（毫秒）',
    last_run_result ENUM('SUCCESS','PARTIAL','FAILED') COMMENT '最后运行结果',
    last_error_msg TEXT,
    total_tables_found INT DEFAULT 0,
    total_columns_found INT DEFAULT 0,
    new_assets_registered INT DEFAULT 0,
    created_by VARCHAR(128),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (data_source_id) REFERENCES data_sources(id),
    INDEX idx_data_source (data_source_id),
    INDEX idx_status (status),
    INDEX idx_schedule (schedule_cron)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='元数据采集任务表';

-- 采集运行日志表
CREATE TABLE IF NOT EXISTS collector_run_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL,
    data_source_id VARCHAR(64) NOT NULL,
    run_type ENUM('MANUAL','SCHEDULED','TRIGGERED') DEFAULT 'MANUAL',
    status ENUM('RUNNING','SUCCESS','FAILED','CANCELLED') DEFAULT 'RUNNING',
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration_ms BIGINT,
    tables_scanned INT DEFAULT 0,
    columns_scanned INT DEFAULT 0,
    assets_created INT DEFAULT 0,
    assets_updated INT DEFAULT 0,
    edges_discovered INT DEFAULT 0,
    errors JSON COMMENT '错误详情数组',
    log_text LONGTEXT COMMENT '详细日志',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task (task_id),
    INDEX idx_start_time (start_time),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采集运行日志表';

-- 元数据快照表（用于时间旅行）
CREATE TABLE IF NOT EXISTS metadata_snapshots (
    id VARCHAR(64) PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    asset_id VARCHAR(64) NOT NULL,
    asset_data JSON COMMENT '资产完整快照',
    columns_data JSON COMMENT '字段完整快照',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_snapshot_asset (snapshot_date, asset_id),
    INDEX idx_snapshot_date (snapshot_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='元数据快照表';
