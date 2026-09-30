-- V6__approval_workflow.sql
-- Publish-gate approval flow: high-risk managed changes must be approved before
-- they are considered released. Extends the change_event state machine with
-- APPROVAL_PENDING / APPROVED / REJECTED and records every decision for audit.

ALTER TABLE change_events
    MODIFY COLUMN status ENUM('DETECTED','ANALYZED','ACK_PENDING','APPROVAL_PENDING','APPROVED','REJECTED','RESOLVED','BLOCKED')
    DEFAULT 'DETECTED' COMMENT '状态：检测→分析→(待审批|待确认)→已批准/已驳回→已解决';

CREATE TABLE IF NOT EXISTS approval_records (
    id VARCHAR(64) NOT NULL COMMENT '审批记录ID',
    change_id VARCHAR(64) NOT NULL COMMENT '关联变更事件ID',
    action ENUM('SUBMIT','APPROVE','REJECT') NOT NULL COMMENT '动作',
    actor VARCHAR(128) COMMENT '操作人',
    comment VARCHAR(512) COMMENT '审批意见',
    decided_at DATETIME COMMENT '决策时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_approval_change (change_id),
    CONSTRAINT fk_approval_change FOREIGN KEY (change_id) REFERENCES change_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='变更审批记录表';
