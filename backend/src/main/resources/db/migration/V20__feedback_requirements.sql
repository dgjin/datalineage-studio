-- V20__feedback_requirements.sql
-- 需求收集与反馈基线（移植自「智能问数据分析系统」v0.9.98–v0.9.105 的「需求收集与反馈」功能）：
-- 1) feedback_entries          需求 / 建议 / 缺陷条目 + 最新评估结论（PENDING → BASELINED / REJECTED）
-- 2) feedback_entry_revisions  评估历史留痕：每次评估（含「继续评估」）追加一条
--
-- 已纳入基线（BASELINED）的条目经标准导出接口（后端 /api/v1/requirements/export，
-- 网关标准路径 /api/requirements/export）提供给「AIOps 自动运维智能体」做主动需求分析
-- （契约 v1.0；能力自描述见 public/.well-known/requirements.json，服务清单声明
-- requirements_path 字段）。

CREATE TABLE IF NOT EXISTS feedback_entries (
    id               VARCHAR(64)  NOT NULL COMMENT '条目 ID（UUID）',
    kind             VARCHAR(20)  NOT NULL DEFAULT 'REQUIREMENT' COMMENT '类型：REQUIREMENT/SUGGESTION/BUG/OTHER',
    title            VARCHAR(200) NOT NULL COMMENT '标题（1-200 字符）',
    content          TEXT         NOT NULL COMMENT '内容描述（1-5000 字符）',
    status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING 待评估 / BASELINED 已纳入基线 / REJECTED 不予采纳',
    priority         VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '基线优先级 P0-P3（仅纳入基线后有值）',
    baseline_version VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '基线版本（可空）',
    assessment       TEXT         NULL COMMENT '管理员最新评估分析意见',
    submitter        VARCHAR(64)  NOT NULL COMMENT '提交人账号（JWT subject；归属过滤依据）',
    department       VARCHAR(100) NOT NULL DEFAULT '' COMMENT '提交人部门（契约预留字段，当前系统无部门维度）',
    reviewer         VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '最近评估人',
    reviewed_at      DATETIME     NULL COMMENT '最近评估时间（退回待评估时清空）',
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近变更时间（导出 since 增量依据）',
    PRIMARY KEY (id),
    INDEX idx_feedback_status (status, updated_at),
    INDEX idx_feedback_submitter (submitter, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='需求反馈条目与最新评估结论';

CREATE TABLE IF NOT EXISTS feedback_entry_revisions (
    id               BIGINT       NOT NULL AUTO_INCREMENT COMMENT '评估记录 ID（自增，升序即评估先后）',
    entry_id         VARCHAR(64)  NOT NULL COMMENT '所属条目 ID',
    action           VARCHAR(20)  NOT NULL COMMENT '评估动作：BASELINE 纳入基线 / REJECT 不予采纳 / PENDING 退回待评估',
    priority         VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '本次评估设定优先级（非 BASELINE 为空串）',
    baseline_version VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '本次评估设定基线版本',
    assessment       TEXT         NULL COMMENT '本次评估意见',
    reviewer         VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '评估人',
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '评估时间',
    PRIMARY KEY (id),
    INDEX idx_feedback_rev_entry (entry_id, id),
    CONSTRAINT fk_feedback_rev_entry FOREIGN KEY (entry_id) REFERENCES feedback_entries (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='需求反馈评估历史（每次评估追加，含继续评估）';
