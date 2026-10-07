-- V15__audit_webhook.sql
-- Enterprise gap closure (evaluation report section 4):
-- 1) audit_logs: full-chain audit trail for every write endpoint (who / what / when /
--    result / latency / client ip), captured by an AOP aspect around controllers.
-- 2) webhook_configs: outbound change subscriptions so external CI/CD pipelines can
--    react to change events, approval decisions and standard violations.

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    username VARCHAR(64) NULL COMMENT '操作者账号（匿名写入时为 anonymous）',
    role VARCHAR(32) NULL COMMENT '操作者角色',
    http_method VARCHAR(10) NOT NULL COMMENT 'HTTP 方法',
    path VARCHAR(255) NOT NULL COMMENT '请求路径',
    action VARCHAR(64) NULL COMMENT '语义化动作（注解声明或由方法+资源推导）',
    resource_type VARCHAR(64) NULL COMMENT '资源类型（由路径推导或注解声明）',
    resource_id VARCHAR(128) NULL COMMENT '资源标识（路径中的 ID 段）',
    summary VARCHAR(500) NULL COMMENT '动作摘要',
    result VARCHAR(16) NOT NULL COMMENT '执行结果 SUCCESS/FAILED',
    duration_ms BIGINT NULL COMMENT '处理耗时（毫秒）',
    client_ip VARCHAR(64) NULL COMMENT '客户端 IP（X-Forwarded-For 优先）',
    created_at DATETIME NOT NULL COMMENT '发生时间',
    INDEX idx_audit_user_time (username, created_at),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='全链路操作审计日志';

CREATE TABLE IF NOT EXISTS webhook_configs (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    name VARCHAR(128) NOT NULL COMMENT '订阅名称',
    url VARCHAR(512) NOT NULL COMMENT '回调地址（https）',
    events JSON NULL COMMENT '订阅事件列表，如 ["change.created","approval.decided"]',
    enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否启用',
    secret VARCHAR(128) NULL COMMENT 'HMAC-SHA256 签名密钥（为空则不加签）',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NULL,
    INDEX idx_webhook_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='变更 Webhook 订阅配置';
