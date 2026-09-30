-- V5__data_standards.sql
-- Data standard hub: the central "标准设计/管理/维护" loop from the governance
-- blueprint. Three layers are covered:
--   1) data_standards   - naming / coding / metric / domain rules (machine-checkable)
--   2) glossary_terms   - business glossary and naming roots (amt, cnt, dt ...)
--   3) reference_codes  - enumeration / reference data dictionaries

CREATE TABLE IF NOT EXISTS data_standards (
    id VARCHAR(64) NOT NULL COMMENT '标准ID',
    code VARCHAR(64) NOT NULL COMMENT '标准编码，如 STD-NAMING-001',
    name VARCHAR(256) NOT NULL COMMENT '标准名称',
    type ENUM('NAMING','CODING','METRIC','DOMAIN') NOT NULL COMMENT '标准类型：命名/编码/指标口径/业务域',
    domain VARCHAR(64) DEFAULT NULL COMMENT '适用业务域',
    rule_expr TEXT COMMENT '机器可校验表达式（正则或DSL）',
    description TEXT COMMENT '标准说明',
    example VARCHAR(512) COMMENT '正例/反例示例',
    severity ENUM('P0','P1','P2') DEFAULT 'P2' COMMENT '违规严重级',
    status ENUM('DRAFT','IN_REVIEW','PUBLISHED','DEPRECATED') DEFAULT 'DRAFT' COMMENT '状态机',
    version VARCHAR(16) DEFAULT 'v1.0',
    owner VARCHAR(128) COMMENT '标准责任人',
    hit_count INT DEFAULT 0 COMMENT '累计命中（违规）次数',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_std_code (code),
    INDEX idx_std_type_status (type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据标准主表';

CREATE TABLE IF NOT EXISTS glossary_terms (
    id VARCHAR(64) NOT NULL COMMENT '词条ID',
    term VARCHAR(128) NOT NULL COMMENT '业务术语（中文）',
    abbr VARCHAR(64) NOT NULL COMMENT '命名词根（英文缩写，如 amt/cnt/dt）',
    category ENUM('ROOT','BUSINESS','TECHNICAL') DEFAULT 'ROOT' COMMENT '词条类别：命名词根/业务术语/技术术语',
    domain VARCHAR(64) DEFAULT NULL COMMENT '业务域',
    synonyms JSON COMMENT '同义词列表',
    definition TEXT COMMENT '定义与使用说明',
    status ENUM('DRAFT','IN_REVIEW','PUBLISHED','DEPRECATED') DEFAULT 'DRAFT',
    version VARCHAR(16) DEFAULT 'v1.0',
    owner VARCHAR(128),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_term_abbr (abbr),
    INDEX idx_term_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='业务术语与命名词根表';

CREATE TABLE IF NOT EXISTS reference_codes (
    id VARCHAR(64) NOT NULL COMMENT '编码项ID',
    code_set VARCHAR(64) NOT NULL COMMENT '编码集，如 ORDER_STATUS',
    set_name VARCHAR(128) COMMENT '编码集名称（订单状态）',
    code_value VARCHAR(64) NOT NULL COMMENT '编码值，如 PAID',
    meaning VARCHAR(128) COMMENT '业务含义（已支付）',
    sort_order INT DEFAULT 0,
    description VARCHAR(512),
    status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_set_value (code_set, code_value),
    INDEX idx_code_set (code_set)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='参考数据（编码字典）表';
