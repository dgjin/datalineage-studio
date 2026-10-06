-- V10__notification_seed.sql
-- M8 通知中心种子数据：与真实质量问题台账(quality_issues)及校验引擎事件强绑定

INSERT IGNORE INTO notifications
  (id, severity, title, body, ref_type, ref_id, `read`, timestamp, actions)
VALUES
('notif:ISS-2026-101', 'CRITICAL', '【P0 Owner 缺失】dwd_customers 责任人未登记',
 'VR-004 资产 Owner 归属完整性检查命中：dw_warehouse.dwd_customers 未登记责任人，变更影响将无法触达 Owner。整改期限 2026-10-12，请尽快指派归属人。',
 'VALIDATION_FAIL', 'issue:ISS-2026-101', FALSE, '2026-10-06 10:21:00',
 '[{"label":"确认受理 (Ack)","action":"ack","variant":"primary"},{"label":"前往校验中心","action":"open_validation","variant":"secondary"}]'),
('notif:ISS-2026-105', 'HIGH', '【P1 注释缺失】ads_sales_overview 4 个字段无注释',
 'VR-003 字段注释覆盖率检查命中：该资产 5 个字段中 4 个无 COMMENT，消费方难以判断语义，需核对字段字典补充说明。',
 'VALIDATION_FAIL', 'issue:ISS-2026-105', FALSE, '2026-10-06 10:29:00',
 '[{"label":"确认受理 (Ack)","action":"ack","variant":"primary"},{"label":"前往校验中心","action":"open_validation","variant":"secondary"}]'),
('notif:ISS-2026-103', 'HIGH', '【P1 Owner 缺失】ads_customer_360 未指定责任人',
 'VR-004 校验命中：应用层核心资产缺少 Owner，影响变更影响分析的触达闭环，请应用研发部补充归属。',
 'VALIDATION_FAIL', 'issue:ISS-2026-103', FALSE, '2026-10-06 10:25:00',
 '[{"label":"确认受理 (Ack)","action":"ack","variant":"primary"},{"label":"前往校验中心","action":"open_validation","variant":"secondary"}]'),
('notif:ISS-2026-102', 'HIGH', '【P1 Owner 缺失】dwd_orders 责任人未登记',
 'VR-004 校验命中：数仓明细层核心资产缺少责任人，跨源变更通知闭环受阻，请数据平台部跟进。',
 'VALIDATION_FAIL', 'issue:ISS-2026-102', FALSE, '2026-10-06 10:23:00',
 '[{"label":"确认受理 (Ack)","action":"ack","variant":"primary"},{"label":"前往校验中心","action":"open_validation","variant":"secondary"}]'),
('notif:ISS-2026-104', 'WARN', '【P2 注释缺失】ads_payment_overview 注释覆盖率不足',
 'VR-003 字段注释覆盖率检查命中：该资产 5 个字段中 4 个无注释，需补齐 COMMENT 以支撑语义治理基线。',
 'VALIDATION_FAIL', 'issue:ISS-2026-104', TRUE, '2026-10-06 10:27:00',
 '[{"label":"前往校验中心","action":"open_validation","variant":"secondary"}]'),
('notif:SCAN-20261006', 'INFO', 'M7 校验引擎扫描完成：28 资产 / 133 字段',
 '今日全量校验扫描完成：执行 8 条启用规则，命中 4 个资产 6 处违规（P0 级 1 处、P1 级 3 处、P2 级 2 处）。质量台账已自动登记 5 项问题。',
 'VALIDATION_FAIL', 'scan:20261006', FALSE, '2026-10-06 08:00:00',
 '[{"label":"查看校验报告","action":"open_validation","variant":"primary"}]'),
('notif:SCAN-20261005', 'INFO', '昨日数据质量复核已完成',
 '2026-10-05 数据质量复核完成：字段注释覆盖率 82%，Owner 覆盖率 75%，较上周提升 6 个百分点。',
 'VALIDATION_FAIL', 'scan:20261005', TRUE, '2026-10-05 18:30:00',
 '[{"label":"前往校验中心","action":"open_validation","variant":"secondary"}]');
