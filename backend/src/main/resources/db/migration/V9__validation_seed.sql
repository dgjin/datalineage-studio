-- V9__validation_seed.sql
-- M7 校验中心种子数据：内置规则库 + 质量问题台账（与真实资产 ID 强绑定，杜绝断链）

-- ============ 内置校验规则 ============
INSERT IGNORE INTO validation_rules
  (id, code, name, category, scope, expression, severity, enabled, description, fix_hint, hit_count)
VALUES
('rule:VR-001', 'VR-001', '资产编码格式合规性检查', 'FORMAT', 'ALL_ASSETS',
 'rule "asset.code.format" {\n  target:  assets(type in [TABLE, VIEW, METRIC])\n  when:    asset.code != null\n  assert:  code matches /^[A-Z0-9-]+$/\n  severity: P0\n  message: "资产编码须符合 UPPER-CASE-HYPHEN 规范"\n  fixHint: "在契约文件或采集映射中修正资产编码"\n}',
 'P0', TRUE,
 '强制所有表、视图、指标编码符合企业唯一命名标准，杜绝同名异义与无序注册。',
 '检查资产 code 是否为全大写字母、数字与连字符组合', 0),
('rule:VR-002', 'VR-002', '资产描述完整性检查', 'COMPLETENESS', 'ALL_ASSETS',
 'rule "asset.description.required" {\n  target:  assets()\n  when:    asset.isManaged == true\n  assert:  asset.description != null && len(asset.description) > 0\n  severity: P1\n  message: "纳管资产必须填写业务描述，禁止空描述上线"\n  fixHint: "在资产详情页或契约文件中补充 description 字段"\n}',
 'P1', TRUE,
 '确保每个纳管资产都有可读的业务描述，避免形成不可理解的暗数据。',
 '为缺失描述的资产补充业务含义说明', 0),
('rule:VR-003', 'VR-003', '字段注释覆盖率检查', 'COMPLETENESS', 'TABLE_COLUMN',
 'rule "column.comment.coverage" {\n  target:  asset.columns\n  assert:  all(columns, c => c.comment != null && len(c.comment) > 0)\n  severity: P1\n  message: "存在无注释字段，数据消费方无法判断语义"\n  fixHint: "在源库补充 COMMENT，或通过字段字典映射补齐"\n}',
 'P1', TRUE,
 '字段注释是语义治理的基础，未注释字段在下游使用中极易产生误用。',
 '为无注释字段补齐 COMMENT 说明', 0),
('rule:VR-004', 'VR-004', '资产 Owner 归属完整性检查', 'SEMANTIC', 'ALL_ASSETS',
 'rule "asset.owner.required" {\n  target:  assets()\n  assert:  asset.owner != null && len(asset.owner) > 0\n  severity: P0\n  message: "资产缺少责任人，变更无法通知到 Owner"\n  fixHint: "明确资产责任人并在资产台账登记"\n}',
 'P0', TRUE,
 '任何资产必须有明确 Owner，否则变更影响无法触达责任人，治理闭环断裂。',
 '在资产台账为缺失责任人资产指定 Owner', 0),
('rule:VR-005', 'VR-005', '指标命名语义一致性检查', 'SEMANTIC', 'METRIC',
 'rule "metric.naming.semantic" {\n  target:  assets(type == METRIC)\n  when:    metric.name contains ["率", "比", "占比"]\n  assert:  metric.unit in ["PERCENT", "RATIO"]\n  severity: P1\n  message: "率/比类指标必须声明为比例型单位"\n  fixHint: "修正指标单位定义，保持语义与命名一致"\n}',
 'P1', TRUE,
 '名称含率/比/占比的指标必须为比例型，保证指标计算口径与展示语义一致。',
 '校验指标单位声明', 0),
('rule:VR-006', 'VR-006', '表名命名规范检查', 'FORMAT', 'TABLE',
 'rule "table.naming.layer_prefix" {\n  target:  assets(type == TABLE)\n  assert:  name matches /^(ods|dwd|dws|ads|dim)_[a-z0-9_]+$/\n  severity: P2\n  message: "表名须以数仓分层前缀开头并保持蛇形小写"\n  fixHint: "重命名或建立别名映射，逐步收敛到规范名"\n}',
 'P2', TRUE,
 '统一数仓表命名分层前缀，降低跨团队理解成本。',
 '将表名收敛到 ods_/dwd_/dws_/ads_/dim_ 前缀规范', 0),
('rule:VR-007', 'VR-007', '血缘 DAG 无环性检查', 'DAG_INTEGRITY', 'LINEAGE',
 'rule "lineage.dag.acyclic" {\n  target:  lineage.graph\n  assert:  !existsCycle(graph)\n  severity: P0\n  message: "血缘图中检测到环路，数据流向不可信"\n  fixHint: "排查环路边的方向，修正采集映射或手工边"\n}',
 'P0', TRUE,
 '血缘图必须保持有向无环，环路会导致影响分析无限传播与调度死锁。',
 '排查并修复形成环路的血缘边', 0),
('rule:VR-008', 'VR-008', '跨系统编码一致性检查', 'CROSS_SYSTEM', 'CROSS_SOURCE',
 'rule "crosssource.code.consistency" {\n  target:  assets(sourceType in [JDBC_SCHEMA, SQL_PARSER])\n  when:    exists peer(table)\n  assert:  peer.code == asset.code\n  severity: P1\n  message: "同一逻辑表在多源间编码不一致"\n  fixHint: "在跨源映射关系中登记统一编码"\n}',
 'P1', TRUE,
 '多数据源并行采集场景下，同一逻辑对象的编码必须跨源一致，否则跨源影响分析失真。',
 '核对跨源映射中的编码一致性', 0);

-- ============ 质量问题台账（与真实资产 ID 绑定） ============
INSERT IGNORE INTO quality_issues
  (id, code, title, description, issue_type, owner_dept, status, priority, affected_asset_id, affected_asset_name, created_by, due_date, created_at)
VALUES
('issue:ISS-2026-101', 'ISS-2026-101', 'dwd_customers 资产 Owner 缺失',
 'VR-004 校验命中：该资产未登记责任人，变更影响无法触达 Owner，需在整改期内补充归属。',
 'OWNERSHIP_MISSING', '数据平台部', 'OPEN', 'P0',
 'asset:dw_warehouse.dwd_customers', 'dwd_customers', 'M7 校验引擎', '2026-10-12', '2026-10-06 10:20:00'),
('issue:ISS-2026-102', 'ISS-2026-102', 'dwd_orders 资产 Owner 缺失',
 'VR-004 校验命中：数仓明细层核心资产缺少责任人，跨源变更通知闭环受阻。',
 'OWNERSHIP_MISSING', '数据平台部', 'IN_PROGRESS', 'P1',
 'asset:dw_warehouse.dwd_orders', 'dwd_orders', 'M7 校验引擎', '2026-10-15', '2026-10-06 10:22:00'),
('issue:ISS-2026-103', 'ISS-2026-103', 'ads_customer_360 未指定责任人',
 'VR-004 校验命中：应用层核心资产缺少 Owner，影响变更影响分析的触达闭环。',
 'OWNERSHIP_MISSING', '应用研发部', 'OPEN', 'P1',
 'asset:dw_app.ads_customer_360', 'ads_customer_360', 'M7 校验引擎', '2026-10-15', '2026-10-06 10:24:00'),
('issue:ISS-2026-104', 'ISS-2026-104', 'ads_payment_overview 字段注释覆盖率不足',
 'VR-003 校验命中：该资产 5 个字段中 4 个无注释，消费方难以判断字段语义，需补齐 COMMENT。',
 'DOC_GAP', '数仓研发组', 'OPEN', 'P2',
 'asset:dl_demo.ads_payment_overview', 'ads_payment_overview', 'M7 校验引擎', '2026-10-20', '2026-10-06 10:26:00'),
('issue:ISS-2026-105', 'ISS-2026-105', 'ads_sales_overview 字段注释覆盖率不足',
 'VR-003 校验命中：该资产 5 个字段中 4 个无注释，需核对字段字典并补齐说明。',
 'DOC_GAP', '数仓研发组', 'OPEN', 'P1',
 'asset:dl_demo.ads_sales_overview', 'ads_sales_overview', 'M7 校验引擎', '2026-10-18', '2026-10-06 10:28:00');
