-- V1__init_schema.sql
-- DataLineage Studio Core Schema
-- MySQL 8.0+

-- 数据资产表
CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(64) PRIMARY KEY COMMENT '资产唯一ID，如 asset:ods_crm_customer',
    code VARCHAR(64) NOT NULL UNIQUE COMMENT '资产编码，如 ODS-CRM-CUST-001',
    name VARCHAR(128) NOT NULL COMMENT '资产物理名',
    display_title VARCHAR(256) COMMENT '资产显示名称',
    type ENUM('TABLE','VIEW','JOB','METRIC','REPORT','DASHBOARD','API','DATASET','FILE') NOT NULL,
    layer ENUM('ODS','DWD','DWS','ADS','APP') NOT NULL,
    space VARCHAR(32) NOT NULL DEFAULT 'default' COMMENT '数据域空间',
    owner VARCHAR(128) COMMENT '负责人',
    owner_email VARCHAR(128) COMMENT '负责人邮箱',
    department VARCHAR(128) COMMENT '所属部门',
    status ENUM('ACTIVE','STALE','PENDING_CHANGE','UNMANAGED','DEPRECATED','DRAFT') DEFAULT 'DRAFT',
    description TEXT,
    confidence INT DEFAULT 100 COMMENT '置信度 0-100',
    source_type ENUM('CONTRACT','OPENLINEAGE','JDBC_SCHEMA','SQL_PARSER','CDC_PROBE') NOT NULL,
    downstream_count INT DEFAULT 0,
    upstream_count INT DEFAULT 0,
    is_managed BOOLEAN DEFAULT TRUE COMMENT '是否已纳管',
    tags JSON COMMENT '标签数组',
    contract_ref VARCHAR(256) COMMENT '关联契约文件路径',
    storage_format VARCHAR(128) COMMENT '存储格式',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_space_layer (space, layer),
    INDEX idx_type_status (type, status),
    INDEX idx_owner (owner)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据资产表';

-- 资产字段表
CREATE TABLE IF NOT EXISTS asset_columns (
    id VARCHAR(64) PRIMARY KEY,
    asset_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    type VARCHAR(64) NOT NULL,
    nullable BOOLEAN DEFAULT TRUE,
    comment TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    is_pii BOOLEAN DEFAULT FALSE,
    sensitivity ENUM('公开','内部','秘密','机密') DEFAULT '内部',
    source_expr VARCHAR(512) COMMENT '来源表达式',
    transform_type ENUM('DIRECT','AGG','FILTER','UDF','JOIN','DERIVED') DEFAULT 'DIRECT',
    last_modified DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    INDEX idx_asset (asset_id),
    INDEX idx_pii (is_pii),
    INDEX idx_sensitivity (sensitivity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产字段表';

-- 血缘关系边表
CREATE TABLE IF NOT EXISTS lineage_edges (
    id VARCHAR(64) PRIMARY KEY,
    from_asset_id VARCHAR(64) NOT NULL,
    to_asset_id VARCHAR(64) NOT NULL,
    from_column VARCHAR(128) COMMENT '源字段名（字段级血缘）',
    to_column VARCHAR(128) COMMENT '目标字段名（字段级血缘）',
    kind ENUM('TABLE','COLUMN','METRIC_REF') NOT NULL,
    source ENUM('CONTRACT','OPENLINEAGE','PARSER','PROBE') NOT NULL,
    confidence INT DEFAULT 100,
    transform_expr TEXT COMMENT '转换表达式',
    is_critical_path BOOLEAN DEFAULT FALSE,
    valid_from DATETIME NOT NULL COMMENT '生效时间',
    valid_to DATETIME COMMENT '失效时间（时间旅行）',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_asset_id) REFERENCES assets(id),
    FOREIGN KEY (to_asset_id) REFERENCES assets(id),
    INDEX idx_from (from_asset_id),
    INDEX idx_to (to_asset_id),
    INDEX idx_valid (valid_from, valid_to),
    INDEX idx_kind_confidence (kind, confidence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='血缘关系边表';

-- 指标定义表
CREATE TABLE IF NOT EXISTS metrics (
    code VARCHAR(64) PRIMARY KEY COMMENT '指标编码',
    name VARCHAR(256) NOT NULL,
    type ENUM('ATOMIC','COMPOSITE') NOT NULL,
    caliber_summary TEXT COMMENT '口径描述',
    entity VARCHAR(128) COMMENT '业务实体',
    measure_expr TEXT COMMENT '度量表达式',
    filter_conditions JSON COMMENT '过滤条件数组',
    dimensions JSON COMMENT '维度数组',
    unit VARCHAR(32) COMMENT '计量单位',
    calc_type ENUM('PERIOD','POINT_IN_TIME') DEFAULT 'PERIOD',
    frequency ENUM('DAILY','MONTHLY','REALTIME') DEFAULT 'DAILY',
    caliber_system ENUM('INTERNAL','PBOC','AMC_EAST') DEFAULT 'INTERNAL',
    owner VARCHAR(128),
    status ENUM('DRAFT','IN_REVIEW','PUBLISHED','DEPRECATED') DEFAULT 'DRAFT',
    version VARCHAR(16) DEFAULT 'v1.0',
    upstream_metrics JSON COMMENT '上游指标编码数组',
    referenced_columns JSON COMMENT '引用物理字段',
    downstream_reports JSON COMMENT '下游报表',
    last_modified DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_owner (owner)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='指标定义表';

-- 指标版本历史表
CREATE TABLE IF NOT EXISTS metric_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    metric_code VARCHAR(64) NOT NULL,
    version VARCHAR(16) NOT NULL,
    diff TEXT COMMENT '变更描述',
    breaking_history_data BOOLEAN DEFAULT FALSE COMMENT '是否破坏历史可比性',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (metric_code) REFERENCES metrics(code),
    INDEX idx_metric (metric_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='指标版本历史表';

-- 变更事件表
CREATE TABLE IF NOT EXISTS change_events (
    id VARCHAR(64) PRIMARY KEY,
    asset_id VARCHAR(64) NOT NULL,
    asset_name VARCHAR(128) NOT NULL,
    change_type ENUM('DROP_COLUMN','RENAME_COLUMN','CHANGE_DATA_TYPE','CHANGE_METRIC_EXPR','DROP_TABLE','ADD_NON_NULL_COLUMN','ADD_NULLABLE_COLUMN') NOT NULL,
    details JSON COMMENT '变更详情',
    detected_by ENUM('CI_CONTRACT','CDC','PROBE','OPENLINEAGE') NOT NULL,
    is_breaking BOOLEAN DEFAULT FALSE,
    is_managed BOOLEAN DEFAULT TRUE,
    status ENUM('DETECTED','ANALYZED','ACK_PENDING','RESOLVED','BLOCKED') DEFAULT 'DETECTED',
    actor VARCHAR(128) COMMENT '操作人',
    trace_id VARCHAR(64) COMMENT '追踪ID',
    mr_url VARCHAR(512) COMMENT 'MR链接',
    impact_verdict ENUM('BLOCKER','HIGH','MEDIUM','LOW','SAFE') DEFAULT 'SAFE',
    impact_summary TEXT,
    affected_metrics INT DEFAULT 0,
    affected_reports INT DEFAULT 0,
    affected_apis INT DEFAULT 0,
    affected_tables INT DEFAULT 0,
    timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    INDEX idx_status (status),
    INDEX idx_timestamp (timestamp),
    INDEX idx_is_managed (is_managed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='变更事件表';

-- 影响确认表
CREATE TABLE IF NOT EXISTS impact_acks (
    id VARCHAR(64) PRIMARY KEY,
    change_id VARCHAR(64) NOT NULL,
    object_id VARCHAR(64) NOT NULL COMMENT '受影响资产ID',
    object_name VARCHAR(256) NOT NULL,
    object_type VARCHAR(32) NOT NULL,
    distance INT COMMENT '波及距离',
    via VARCHAR(512) COMMENT '影响路径',
    owner VARCHAR(128),
    department VARCHAR(128),
    ack_status ENUM('PENDING','ACKED','REJECTED','EXEMPTED') DEFAULT 'PENDING',
    exempt_reason TEXT,
    exempt_until DATETIME,
    acked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (change_id) REFERENCES change_events(id),
    INDEX idx_change (change_id),
    INDEX idx_ack_status (ack_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='影响确认表';

-- 数据契约表
CREATE TABLE IF NOT EXISTS contracts (
    id VARCHAR(64) PRIMARY KEY,
    path VARCHAR(256) NOT NULL UNIQUE COMMENT '契约文件路径',
    domain VARCHAR(64) NOT NULL,
    version VARCHAR(16) DEFAULT 'v1.0',
    author VARCHAR(128),
    status ENUM('MERGED','IN_REVIEW','DRAFT') DEFAULT 'DRAFT',
    yaml_content TEXT COMMENT 'YAML 契约内容',
    generated_ddl TEXT COMMENT '生成的 DDL',
    last_updated DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_domain (domain),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据契约表';

-- 校验规则表
CREATE TABLE IF NOT EXISTS validation_rules (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(256) NOT NULL,
    category ENUM('FORMAT','COMPLETENESS','SEMANTIC','DAG_INTEGRITY','CROSS_SYSTEM') NOT NULL,
    scope VARCHAR(64) NOT NULL COMMENT '作用范围',
    expression TEXT COMMENT '规则表达式 DSL',
    severity ENUM('P0','P1','P2') DEFAULT 'P2',
    enabled BOOLEAN DEFAULT TRUE,
    description TEXT,
    fix_hint VARCHAR(512),
    hit_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='校验规则表';

-- 质量问题表
CREATE TABLE IF NOT EXISTS quality_issues (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    issue_type VARCHAR(64) NOT NULL,
    owner_dept VARCHAR(128),
    status ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED') DEFAULT 'OPEN',
    priority ENUM('P0','P1','P2') DEFAULT 'P2',
    affected_asset_id VARCHAR(64),
    affected_asset_name VARCHAR(128),
    created_by VARCHAR(128),
    due_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质量问题表';

-- 采集器适配器表
CREATE TABLE IF NOT EXISTS collector_adapters (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    type ENUM('JDBC_SCHEMA','OPENLINEAGE','SQL_FILE','DBT_MANIFEST','AIRFLOW','CDC_DEBEZIUM','BI_SUPERSET') NOT NULL,
    mode ENUM('PULL','PUSH','SCAN') NOT NULL,
    status ENUM('RUNNING','DEGRADED','STANDBY','ERROR') DEFAULT 'STANDBY',
    capabilities JSON COMMENT '能力列表',
    config JSON COMMENT '采集器配置（连接串、认证等）',
    last_run_time DATETIME,
    total_assets_discovered INT DEFAULT 0,
    changes_captured_24h INT DEFAULT 0,
    avg_latency VARCHAR(32),
    health_score INT DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采集器适配器表';

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    severity ENUM('CRITICAL','HIGH','WARN','INFO') DEFAULT 'INFO',
    title VARCHAR(256) NOT NULL,
    body TEXT,
    ref_type ENUM('CHANGE_EVENT','IMPACT_ACK','DARK_CHANGE','VALIDATION_FAIL') NOT NULL,
    ref_id VARCHAR(64) NOT NULL,
    `read` BOOLEAN DEFAULT FALSE,
    timestamp DATETIME NOT NULL,
    actions JSON COMMENT '可操作按钮',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_read (`read`),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知表';
