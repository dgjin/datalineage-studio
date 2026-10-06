-- V13: RBAC — users & roles for JWT-based authentication
-- Three built-in roles:
--   ADMIN    : full access (platform administration + all governance writes)
--   GOVERNOR : governance operations (all write endpoints)
--   VIEWER   : read-only (GET endpoints only)

CREATE TABLE IF NOT EXISTS roles (
    code        VARCHAR(32)  NOT NULL,
    name        VARCHAR(64)  NOT NULL,
    description VARCHAR(255) NULL,
    permissions TEXT         NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
    id            VARCHAR(64)  NOT NULL,
    username      VARCHAR(64)  NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    display_name  VARCHAR(64)  NOT NULL,
    role_code     VARCHAR(32)  NOT NULL,
    status        VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username),
    CONSTRAINT fk_users_role FOREIGN KEY (role_code) REFERENCES roles (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO roles (code, name, description, permissions) VALUES
('ADMIN',    '平台管理员', '全量权限：采集/治理/标准/数据源管理与用户管理', '["*"]'),
('GOVERNOR', '治理管理员', '治理写操作：采集触发、变更审批、标准发布、契约维护', '["collect:run","change:approve","standard:publish","contract:write"]'),
('VIEWER',   '只读观察员', '只读访问：浏览资产、血缘、指标、契约与校验结果', '["read"]');

-- Demo accounts (passwords are BCrypt-hashed):
--   admin    / admin123
--   governor / governor123
--   viewer   / viewer123
INSERT INTO users (id, username, password_hash, display_name, role_code, status) VALUES
('user-admin-001',    'admin',    '$2a$10$lg4dPsKQu/TB.BLZiCfwaO/tDTtfr/VayuT.MAZK7aadce1VtTKBe', '林浩然', 'ADMIN',    'ACTIVE'),
('user-governor-001', 'governor', '$2a$10$VO12iWGp2Ghor0DtaIyakutNmhOj.FHKdXW4.8978TTpLCH1L88sm', '赵静',   'GOVERNOR', 'ACTIVE'),
('user-viewer-001',   'viewer',   '$2a$10$XgahY30UJn.0OqonoBHqr.4RaABhec7eqRkOUNeR/VGZVj/4Zx6N6', '苏婉清', 'VIEWER',   'ACTIVE');
