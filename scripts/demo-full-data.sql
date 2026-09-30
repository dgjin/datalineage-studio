-- ============================================================================
-- demo-full-data.sql — 完整功能测试数据集（可切换版本 A: full）
-- 覆盖：数据标准 / 术语词根 / 编码字典 / 契约 / 指标 / 校验规则 / 质量问题 /
--       变更事件（含审批门禁状态机） / 审批流水 / 通知
-- 前置：先执行 demo-dataset.sql 完成五层资产采集（20 资产基线）
-- 切换：scripts/switch-demo.sh full | baseline
-- ============================================================================

USE datalineage;

-- ---- 幂等清理（仅清理本数据集标记的数据） ----
DELETE FROM approval_records WHERE id LIKE 'apr-demo%';
DELETE FROM change_events WHERE id LIKE 'chg-demo%';
DELETE FROM notifications WHERE id LIKE 'ntf-demo%';
DELETE FROM quality_issues WHERE id LIKE 'qis-demo%' OR code LIKE 'QI-DEMO%' OR code LIKE 'QI-NAMING-%';
DELETE FROM validation_rules WHERE id LIKE 'vr-demo%';
DELETE FROM metric_history WHERE metric_code IN ('order_amount','order_count','avg_order_value','total_sales','customer_count','customer_value_total','category_sales_qty','dashboard_kpi_value');
DELETE FROM metrics WHERE code IN ('order_amount','order_count','avg_order_value','total_sales','customer_count','customer_value_total','category_sales_qty','dashboard_kpi_value');
DELETE FROM contracts WHERE id LIKE 'ct-demo%';
DELETE FROM data_standards WHERE id LIKE 'std-demo%';
-- 清理占用演示标准编码的非演示记录（如 API 冒烟残留），避免 uk_std_code 唯一键冲突
DELETE FROM data_standards WHERE code IN
('STD-NAMING-001','STD-NAMING-002','STD-NAMING-003','STD-CODING-001','STD-CODING-002','STD-METRIC-001','STD-METRIC-002','STD-DOMAIN-001');
DELETE FROM glossary_terms WHERE id LIKE 'glo-demo%';
DELETE FROM reference_codes WHERE id LIKE 'rc-demo%';
UPDATE assets SET contract_ref = NULL WHERE contract_ref LIKE 'contracts/%';

-- ---- 资产 ID 变量（与采集结果解耦，按名称查找） ----
SET @a_orders := (SELECT id FROM assets WHERE name = 'ods_orders' LIMIT 1);
SET @a_customers := (SELECT id FROM assets WHERE name = 'ods_customers' LIMIT 1);
SET @a_order_items := (SELECT id FROM assets WHERE name = 'ods_order_items' LIMIT 1);
SET @a_products := (SELECT id FROM assets WHERE name = 'ods_products' LIMIT 1);
SET @a_payments := (SELECT id FROM assets WHERE name = 'ods_payments' LIMIT 1);
SET @a_dws_metrics := (SELECT id FROM assets WHERE name = 'dws_order_metrics' LIMIT 1);
SET @a_dws_cat := (SELECT id FROM assets WHERE name = 'dws_category_sales' LIMIT 1);
SET @a_dws_cust := (SELECT id FROM assets WHERE name = 'dws_customer_value' LIMIT 1);
SET @a_ads_sales := (SELECT id FROM assets WHERE name = 'ads_sales_overview' LIMIT 1);
SET @a_app_kpi := (SELECT id FROM assets WHERE name = 'app_dashboard_kpi' LIMIT 1);

-- ============================================================================
-- 1) 数据标准（标准设计/管理/维护中枢）
-- ============================================================================
INSERT INTO data_standards (id, code, name, type, domain, rule_expr, description, example, severity, status, version, owner, hit_count) VALUES
('std-demo-001', 'STD-NAMING-001', '数仓分层前缀命名规范', 'NAMING', '数仓', '^(ods|dwd|dws|ads|app)_[a-z][a-z0-9]*(_[a-z0-9]+)*$', '五层对象必须以层前缀（ods_/dwd_/dws_/ads_/app_）开头，全小写下划线分隔', 'ods_orders / dwd_order_detail / app_dashboard_kpi', 'P1', 'PUBLISHED', 'v1.2', '数据架构组', 1),
('std-demo-002', 'STD-NAMING-002', '字段命名规范（词根驱动）', 'NAMING', '数仓', '^[a-z][a-z0-9_]*$', '字段命名必须由已登记词根组成，禁止驼峰与中文拼音缩写', 'total_amount / order_cnt / dt', 'P1', 'PUBLISHED', 'v1.0', '数据架构组', 0),
('std-demo-003', 'STD-NAMING-003', '对象前缀白名单规范', 'NAMING', '数仓', '^(ods|dwd|dws|ads|app|tmp|bak|legacy)_[a-z0-9_]+$', '对象前缀必须来自白名单：五层前缀或 tmp_/bak_/legacy_ 临时前缀（临时/遗留对象需在标准中枢登记下线计划）', 'tmp_order_export / legacy_report_tmp', 'P2', 'PUBLISHED', 'v1.0', '数据架构组', 0),
('std-demo-004', 'STD-CODING-001', '订单状态编码标准', 'CODING', '交易域', '^(PENDING|PAID|SHIPPED|REFUNDED|CANCELLED)$', 'orders.status 取值必须来自 ORDER_STATUS 编码集', 'PAID', 'P1', 'PUBLISHED', 'v1.1', '交易域 Owner', 0),
('std-demo-005', 'STD-CODING-002', '支付方式编码标准', 'CODING', '支付域', '^(ALIPAY|WECHAT|CARD|BALANCE)$', 'payments.method 取值必须来自 PAYMENT_METHOD 编码集', 'ALIPAY', 'P2', 'DRAFT', 'v0.9', '支付域 Owner', 0),
('std-demo-006', 'STD-METRIC-001', '指标编码与口径规范', 'METRIC', '全域', '^[a-z][a-z0-9_]*$', '指标编码全小写下划线；口径必须绑定 referenced_columns 物理列后方可发布（发布门禁）', 'order_amount → dws_order_metrics.gmv', 'P0', 'PUBLISHED', 'v1.0', '指标管理组', 0),
('std-demo-007', 'STD-METRIC-002', '比率类指标百分数规范', 'METRIC', '全域', 'pct$|rate$', '比率/占比类指标以 pct/rate 结尾，单位统一为百分比', 'refund_rate / conversion_rate', 'P2', 'DRAFT', 'v0.5', '指标管理组', 0),
('std-demo-008', 'STD-DOMAIN-001', '业务域划分标准', 'DOMAIN', '全域', NULL, '业务域统一为：客户域/交易域/商品域/支付域/全域', '客户域', 'P2', 'PUBLISHED', 'v1.0', '数据治理组', 0);

-- ============================================================================
-- 2) 术语词根（业务词典 / 命名词根）
-- ============================================================================
INSERT INTO glossary_terms (id, term, abbr, category, domain, synonyms, definition, status, version, owner) VALUES
('glo-demo-001', '金额', 'amt', 'ROOT', '全域', JSON_ARRAY('amount', '交易金额'), '用于金额类字段，单位统一为元，如 order_amt / total_amt', 'PUBLISHED', 'v1.0', '数据架构组'),
('glo-demo-002', '数量', 'cnt', 'ROOT', '全域', JSON_ARRAY('count', '笔数'), '计数类字段词根，如 order_cnt / item_cnt', 'PUBLISHED', 'v1.0', '数据架构组'),
('glo-demo-003', '日期', 'dt', 'ROOT', '全域', JSON_ARRAY('date', 'day'), '分区日期词根，如 dt / stat_dt，格式 yyyy-MM-dd', 'PUBLISHED', 'v1.0', '数据架构组'),
('glo-demo-004', '标识', 'id', 'ROOT', '全域', JSON_ARRAY('identifier', '主键'), '唯一标识词根，如 order_id / customer_id', 'PUBLISHED', 'v1.0', '数据架构组'),
('glo-demo-005', '状态', 'st', 'ROOT', '全域', JSON_ARRAY('status', 'state'), '状态类字段词根，取值必须来自对应编码字典', 'PUBLISHED', 'v1.0', '数据架构组'),
('glo-demo-006', '名称', 'nm', 'ROOT', '全域', JSON_ARRAY('name'), '名称类字段词根，如 product_nm', 'PUBLISHED', 'v1.0', '数据架构组'),
('glo-demo-007', '成交总额', 'gmv', 'BUSINESS', '交易域', JSON_ARRAY('GMV', '总交易额'), '一定周期内成交订单金额之和（含退款前口径）', 'PUBLISHED', 'v1.1', '交易域 Owner'),
('glo-demo-008', '客单价', 'aov', 'BUSINESS', '交易域', JSON_ARRAY('average order value'), 'GMV ÷ 订单量，金额类比率指标', 'PUBLISHED', 'v1.0', '交易域 Owner'),
('glo-demo-009', '客户价值分层', 'value_tier', 'BUSINESS', '客户域', JSON_ARRAY('RFM层级', '客户分层'), '按累计消费额划分 V0-V3 四档，见 encoding CUSTOMER_LEVEL', 'PUBLISHED', 'v1.0', '客户域 Owner'),
('glo-demo-010', '个人敏感信息', 'pii', 'TECHNICAL', '全域', JSON_ARRAY('PII', '隐私数据'), '手机号/邮箱/证件号等，落库必须标记 is_pii 并做脱敏', 'PUBLISHED', 'v1.0', '安全合规组'),
('glo-demo-011', '支付方式', 'pay_method', 'BUSINESS', '支付域', JSON_ARRAY('payment method'), '订单支付渠道，见编码集 PAYMENT_METHOD', 'PUBLISHED', 'v1.0', '支付域 Owner'),
('glo-demo-012', '刷新时间', 'refreshed_at', 'TECHNICAL', '全域', JSON_ARRAY('update time'), '数仓加工表最近一次刷新时间戳', 'PUBLISHED', 'v1.0', '数据架构组');

-- ============================================================================
-- 3) 编码字典（参考数据）
-- ============================================================================
INSERT INTO reference_codes (id, code_set, set_name, code_value, meaning, sort_order, status) VALUES
('rc-demo-001', 'ORDER_STATUS', '订单状态', 'PENDING', '待支付', 10, 'ACTIVE'),
('rc-demo-002', 'ORDER_STATUS', '订单状态', 'PAID', '已支付', 20, 'ACTIVE'),
('rc-demo-003', 'ORDER_STATUS', '订单状态', 'SHIPPED', '已发货', 30, 'ACTIVE'),
('rc-demo-004', 'ORDER_STATUS', '订单状态', 'REFUNDED', '已退款', 40, 'ACTIVE'),
('rc-demo-005', 'ORDER_STATUS', '订单状态', 'CANCELLED', '已取消', 50, 'ACTIVE'),
('rc-demo-006', 'PAYMENT_METHOD', '支付方式', 'ALIPAY', '支付宝', 10, 'ACTIVE'),
('rc-demo-007', 'PAYMENT_METHOD', '支付方式', 'WECHAT', '微信支付', 20, 'ACTIVE'),
('rc-demo-008', 'PAYMENT_METHOD', '支付方式', 'CARD', '银行卡', 30, 'ACTIVE'),
('rc-demo-009', 'PAYMENT_METHOD', '支付方式', 'BALANCE', '余额支付', 40, 'ACTIVE'),
('rc-demo-010', 'CUSTOMER_LEVEL', '客户价值分层', 'V0', '普通客户', 10, 'ACTIVE'),
('rc-demo-011', 'CUSTOMER_LEVEL', '客户价值分层', 'V1', '潜力客户', 20, 'ACTIVE'),
('rc-demo-012', 'CUSTOMER_LEVEL', '客户价值分层', 'V2', '优质客户', 30, 'ACTIVE'),
('rc-demo-013', 'CUSTOMER_LEVEL', '客户价值分层', 'V3', '高价值客户', 40, 'ACTIVE'),
('rc-demo-014', 'PRODUCT_CATEGORY', '商品类目', 'ELECTRONICS', '数码电子', 10, 'ACTIVE'),
('rc-demo-015', 'PRODUCT_CATEGORY', '商品类目', 'CLOTHING', '服饰', 20, 'ACTIVE'),
('rc-demo-016', 'PRODUCT_CATEGORY', '商品类目', 'FOOD', '食品', 30, 'ACTIVE'),
('rc-demo-017', 'PRODUCT_CATEGORY', '商品类目', 'HOME', '家居', 40, 'ACTIVE');

-- ============================================================================
-- 4) 契约（GitOps 数据契约，绑定到资产提升契约覆盖率）
-- ============================================================================
INSERT INTO contracts (id, path, domain, version, author, status, yaml_content, generated_ddl, last_updated) VALUES
('ct-demo-001', 'contracts/ods/ods_orders.yml', '交易域', 'v2.1', '张架构', 'MERGED',
'schemaVersion: "2.0"\ndataset: ods_orders\nowner: 交易域\ntier: P0\ncolumns:\n  - name: id\n    type: BIGINT\n    primaryKey: true\n  - name: customer_id\n    type: BIGINT\n  - name: amount\n    type: DECIMAL(18,2)\n    unit: cny\n  - name: status\n    type: VARCHAR(32)\n    encoding: ORDER_STATUS\nsla:\n  freshness: 1h',
'CREATE TABLE ods_orders (\n  id BIGINT PRIMARY KEY,\n  customer_id BIGINT,\n  amount DECIMAL(18,2),\n  status VARCHAR(32)\n);', NOW() - INTERVAL 2 DAY),
('ct-demo-002', 'contracts/ods/ods_customers.yml', '客户域', 'v1.8', '李数仓', 'MERGED',
'schemaVersion: "2.0"\ndataset: ods_customers\nowner: 客户域\npii:\n  - phone\n  - email\ncolumns:\n  - name: id\n    type: BIGINT\n    primaryKey: true\n  - name: name\n    type: VARCHAR(128)\n  - name: phone\n    type: VARCHAR(32)\n    masked: true',
'CREATE TABLE ods_customers (\n  id BIGINT PRIMARY KEY,\n  name VARCHAR(128),\n  phone VARCHAR(32)\n);', NOW() - INTERVAL 5 DAY),
('ct-demo-003', 'contracts/ods/ods_order_items.yml', '交易域', 'v1.4', '张架构', 'MERGED',
'schemaVersion: "2.0"\ndataset: ods_order_items\nowner: 交易域\ncolumns:\n  - name: id\n    type: BIGINT\n    primaryKey: true\n  - name: order_id\n    type: BIGINT\n    references: ods_orders.id\n  - name: quantity\n    type: INT\n  - name: unit_price\n    type: DECIMAL(18,2)',
'CREATE TABLE ods_order_items (\n  id BIGINT PRIMARY KEY,\n  order_id BIGINT,\n  quantity INT,\n  unit_price DECIMAL(18,2)\n);', NOW() - INTERVAL 5 DAY),
('ct-demo-004', 'contracts/dws/dws_order_metrics.yml', '交易域', 'v3.0', '王指标', 'MERGED',
'schemaVersion: "2.0"\ndataset: dws_order_metrics\nowner: 指标管理组\nmetrics:\n  - order_cnt\n  - gmv\n  - avg_amount\nsla:\n  freshness: 4h\n  refresh: daily',
'CREATE TABLE dws_order_metrics (\n  id BIGINT PRIMARY KEY,\n  metric_date DATE,\n  order_cnt BIGINT,\n  gmv DECIMAL(18,2),\n  avg_amount DECIMAL(18,2)\n);', NOW() - INTERVAL 1 DAY),
('ct-demo-005', 'contracts/dws/dws_customer_value.yml', '客户域', 'v1.2', '李数仓', 'IN_REVIEW',
'schemaVersion: "2.0"\ndataset: dws_customer_value\nowner: 客户域\ncolumns:\n  - name: customer_id\n  - name: order_cnt\n  - name: total_amount\n  - name: value_tier\n    encoding: CUSTOMER_LEVEL',
'CREATE OR REPLACE VIEW dws_customer_value AS SELECT ...;', NOW() - INTERVAL 6 HOUR),
('ct-demo-006', 'contracts/ads/ads_sales_overview.yml', '交易域', 'v1.1', '王指标', 'DRAFT',
'schemaVersion: "2.0"\ndataset: ads_sales_overview\nowner: 指标管理组\ncolumns:\n  - name: category\n  - name: total_qty\n  - name: total_sales\n  - name: sales_grade',
'CREATE OR REPLACE VIEW ads_sales_overview AS SELECT ...;', NOW() - INTERVAL 3 HOUR);

-- 契约绑定到资产（提升契约覆盖率 = 提升健康分）
UPDATE assets SET contract_ref = 'contracts/ods/ods_orders.yml' WHERE name = 'ods_orders';
UPDATE assets SET contract_ref = 'contracts/ods/ods_customers.yml' WHERE name = 'ods_customers';
UPDATE assets SET contract_ref = 'contracts/ods/ods_order_items.yml' WHERE name = 'ods_order_items';
UPDATE assets SET contract_ref = 'contracts/dws/dws_order_metrics.yml' WHERE name = 'dws_order_metrics';
UPDATE assets SET contract_ref = 'contracts/dws/dws_customer_value.yml' WHERE name = 'dws_customer_value';
UPDATE assets SET contract_ref = 'contracts/ads/ads_sales_overview.yml' WHERE name = 'ads_sales_overview';

-- ============================================================================
-- 5) 指标（口径绑定真实物理列，经过发布门禁校验）
-- ============================================================================
INSERT INTO metrics (code, name, type, caliber_summary, entity, measure_expr, filter_conditions, dimensions, unit, calc_type, frequency, caliber_system, owner, status, version, upstream_metrics, referenced_columns, downstream_reports, last_modified) VALUES
('order_amount', '订单成交总额', 'ATOMIC', '统计周期内成交订单金额之和（含退款前口径）', '订单', 'SUM(gmv)', JSON_ARRAY('status NOT IN (CANCELLED)'), JSON_ARRAY('dt', 'category'), '元', 'PERIOD', 'DAILY', 'INTERNAL', '王指标', 'PUBLISHED', 'v1.2', JSON_ARRAY(), JSON_ARRAY(JSON_OBJECT('assetId', CONCAT('asset:dl_demo.dws_order_metrics'), 'assetName', 'dws_order_metrics', 'columnName', 'gmv', 'confidence', 95)), JSON_ARRAY('BI 经营日报', 'APP 驾驶舱'), NOW() - INTERVAL 1 DAY),
('order_count', '订单量', 'ATOMIC', '统计周期内有效订单笔数', '订单', 'COUNT(DISTINCT id)', JSON_ARRAY('status NOT IN (CANCELLED)'), JSON_ARRAY('dt'), '笔', 'PERIOD', 'DAILY', 'INTERNAL', '王指标', 'PUBLISHED', 'v1.1', JSON_ARRAY(), JSON_ARRAY(JSON_OBJECT('assetId', 'asset:dl_demo.dws_order_metrics', 'assetName', 'dws_order_metrics', 'columnName', 'order_cnt', 'confidence', 95)), JSON_ARRAY('BI 经营日报'), NOW() - INTERVAL 1 DAY),
('avg_order_value', '客单价 AOV', 'COMPOSITE', '成交总额 ÷ 订单量，反映单笔订单平均金额', '订单', 'order_amount / order_count', JSON_ARRAY(), JSON_ARRAY('dt', 'category'), '元', 'PERIOD', 'DAILY', 'INTERNAL', '王指标', 'PUBLISHED', 'v1.0', JSON_ARRAY('order_amount', 'order_count'), JSON_ARRAY(JSON_OBJECT('assetId', 'asset:dl_demo.dws_order_metrics', 'assetName', 'dws_order_metrics', 'columnName', 'avg_amount', 'confidence', 95)), JSON_ARRAY('BI 经营日报', '管理层周报'), NOW() - INTERVAL 1 DAY),
('total_sales', '销售额', 'ATOMIC', '各品类销售金额合计（quantity × unit_price 汇总）', '商品明细', 'SUM(total_sales)', JSON_ARRAY(), JSON_ARRAY('category'), '元', 'PERIOD', 'DAILY', 'INTERNAL', '王指标', 'PUBLISHED', 'v1.3', JSON_ARRAY(), JSON_ARRAY(JSON_OBJECT('assetId', 'asset:dl_demo.dws_category_sales', 'assetName', 'dws_category_sales', 'columnName', 'total_sales', 'confidence', 95)), JSON_ARRAY('BI 销售月报'), NOW() - INTERVAL 2 DAY),
('customer_count', '客户数', 'ATOMIC', '统计周期内有消费行为的客户数', '客户', 'COUNT(DISTINCT customer_id)', JSON_ARRAY(), JSON_ARRAY('value_tier'), '人', 'PERIOD', 'MONTHLY', 'INTERNAL', '李数仓', 'PUBLISHED', 'v1.0', JSON_ARRAY(), JSON_ARRAY(JSON_OBJECT('assetId', 'asset:dl_demo.dws_customer_value', 'assetName', 'dws_customer_value', 'columnName', 'customer_id', 'confidence', 95)), JSON_ARRAY('CRM 客户月报'), NOW() - INTERVAL 3 DAY),
('customer_value_total', '客户价值总额', 'ATOMIC', '客户累计消费金额（用于价值分层）', '客户', 'SUM(total_amount)', JSON_ARRAY(), JSON_ARRAY('value_tier'), '元', 'POINT_IN_TIME', 'DAILY', 'INTERNAL', '李数仓', 'PUBLISHED', 'v1.0', JSON_ARRAY(), JSON_ARRAY(JSON_OBJECT('assetId', 'asset:dl_demo.dws_customer_value', 'assetName', 'dws_customer_value', 'columnName', 'total_amount', 'confidence', 95)), JSON_ARRAY('CRM 客户月报'), NOW() - INTERVAL 3 DAY),
('category_sales_qty', '品类销量', 'ATOMIC', '各品类商品销售数量合计', '商品明细', 'SUM(total_qty)', JSON_ARRAY(), JSON_ARRAY('category'), '件', 'PERIOD', 'DAILY', 'INTERNAL', '王指标', 'IN_REVIEW', 'v0.9', JSON_ARRAY(), JSON_ARRAY(JSON_OBJECT('assetId', 'asset:dl_demo.ads_sales_overview', 'assetName', 'ads_sales_overview', 'columnName', 'total_qty', 'confidence', 90)), JSON_ARRAY('BI 销售月报'), NOW() - INTERVAL 4 HOUR),
('dashboard_kpi_value', '驾驶舱 KPI 值', 'COMPOSITE', 'APP 驾驶舱统一 KPI 出口，聚合多口径指标', '全域', 'kpi_value', JSON_ARRAY(), JSON_ARRAY('kpi_name'), '-', 'POINT_IN_TIME', 'DAILY', 'INTERNAL', '指标管理组', 'PUBLISHED', 'v1.0', JSON_ARRAY('order_amount', 'total_sales'), JSON_ARRAY(JSON_OBJECT('assetId', 'asset:dl_demo.app_dashboard_kpi', 'assetName', 'app_dashboard_kpi', 'columnName', 'kpi_value', 'confidence', 95)), JSON_ARRAY('APP 驾驶舱'), NOW() - INTERVAL 1 DAY);

INSERT INTO metric_history (metric_code, version, diff, breaking_history_data) VALUES
('order_amount', 'v1.1', 'Caliber changed; 口径补充"含退款前"说明', 0),
('order_amount', 'v1.2', 'Version v1.1 -> v1.2; 绑定物理列 dws_order_metrics.gmv', 0),
('total_sales', 'v1.3', 'Measure expression changed (breaking history comparability); 由 SUM(amount) 调整为明细单价×数量汇总', 1);

-- ============================================================================
-- 6) 校验规则（五类规则引擎）
-- ============================================================================
INSERT INTO validation_rules (id, code, name, category, scope, expression, severity, enabled, description, fix_hint, hit_count) VALUES
('vr-demo-001', 'VR-001', '分层前缀命名检查', 'FORMAT', 'asset.name', 'matches(^(ods|dwd|dws|ads|app)_[a-z][a-z0-9_]*$)', 'P1', 1, '校验资产名符合 STD-NAMING-001 分层前缀规范', '重命名对象或登记临时对象前缀（tmp_/legacy_）', 1),
('vr-demo-002', 'VR-002', '保留字与大小写检查', 'FORMAT', 'asset.name', 'not matches(A-Z) && not in (select,from,where)', 'P2', 1, '禁止使用 SQL 保留字与大写字母命名', '改为全小写下划线命名', 0),
('vr-demo-003', 'VR-003', '主键非空检查', 'COMPLETENESS', 'column.primaryKey', 'isNotNull', 'P0', 1, '所有主键列必须有值与唯一约束', '补充主键或唯一索引', 0),
('vr-demo-004', 'VR-004', '核心字段空值率检查', 'COMPLETENESS', 'column.nullRate', '< 0.05', 'P1', 1, 'P0 资产核心字段空值率需低于 5%', '回溯补数与上游空值治理', 2),
('vr-demo-005', 'VR-005', '金额单位一致性检查', 'SEMANTIC', 'column.unit', 'unit in (cny)', 'P0', 1, '金额类字段单位统一为元，禁止分/美元混用', '统一换算为元并更新契约 unit 标注', 1),
('vr-demo-006', 'VR-006', '编码值合法性检查', 'SEMANTIC', 'column.encoding', 'value in reference_codes', 'P1', 1, '状态/枚举字段取值必须存在于对应编码字典', '补录编码集或修正数据取值', 3),
('vr-demo-007', 'VR-007', '血缘无环检查', 'DAG_INTEGRITY', 'lineage.graph', 'acyclic', 'P0', 1, '血缘图不允许出现环路（自引用/A↔B 循环）', '断环并修正加工链路', 0),
('vr-demo-008', 'VR-008', '断链检查（孤立上游）', 'DAG_INTEGRITY', 'lineage.graph', 'allUpstreamResolvable', 'P1', 1, 'DWD 及以上层资产必须有可追溯的上游', '补录血缘或标记为外部引入', 0),
('vr-demo-009', 'VR-009', '契约一致性检查', 'CROSS_SYSTEM', 'contract.schema', 'schema == actualSchema', 'P0', 1, '实际表结构与 Git 契约声明必须一致', '执行契约补丁 MR 或回滚结构变更', 1),
('vr-demo-010', 'VR-010', '刷新时效性检查', 'CROSS_SYSTEM', 'asset.freshness', '< 24h', 'P2', 1, 'T+1 资产必须在次日 08:00 前完成刷新', '排查调度链路并补跑', 1);

-- ============================================================================
-- 7) 质量问题（人工 + 命名校验自动产生）
-- ============================================================================
INSERT INTO quality_issues (id, code, title, description, issue_type, owner_dept, status, priority, affected_asset_id, affected_asset_name, created_by, due_date) VALUES
('qis-demo-001', 'QI-DEMO-001', '金额单位不一致：ods_order_items.unit_price 疑似以分存储', '抽检发现 unit_price 数值为 amount 单价的 100 倍，疑似单位为分，违反 STD-METRIC-001 与 VR-005', 'UNIT_MISMATCH', '交易域', 'OPEN', 'P0', @a_order_items, 'ods_order_items', '质量抽检机器人', CURDATE() + INTERVAL 3 DAY),
('qis-demo-002', 'QI-DEMO-002', 'dws_order_metrics 刷新延迟超过 SLA', '最近一次刷新时间晚于 SLA（4h）约束，下游 BI 报表存在取数延迟风险', 'FRESHNESS_SLA', '指标管理组', 'IN_PROGRESS', 'P1', @a_dws_metrics, 'dws_order_metrics', '调度监控', CURDATE() + INTERVAL 5 DAY),
('qis-demo-003', 'QI-DEMO-003', '核心资产缺少业务描述与 Owner 备份', 'ods_payments 未配置 Owner 备份人与业务描述，影响应急响应', 'METADATA_GAP', '支付域', 'OPEN', 'P2', @a_payments, 'ods_payments', '元数据巡检', CURDATE() + INTERVAL 10 DAY);

-- ============================================================================
-- 8) 变更事件（覆盖完整状态机：待审批/已批准/已驳回/待确认/未纳管/已解决）
-- ============================================================================
INSERT INTO change_events (id, asset_id, asset_name, change_type, details, detected_by, is_breaking, is_managed, status, actor, trace_id, mr_url, impact_verdict, impact_summary, affected_metrics, affected_reports, affected_apis, affected_tables, timestamp) VALUES
('chg-demo-001', @a_orders, 'ods_orders', 'DROP_COLUMN', JSON_OBJECT('column', 'remark', 'oldValue', 'VARCHAR(255)', 'newValue', NULL, 'rawDiff', '- remark VARCHAR(255)  -- 未走契约流程直接删除'), 'PROBE', 1, 1, 'APPROVAL_PENDING', '自动门禁', 'trace-7f3a91', NULL, 'BLOCKER', '删除 ods_orders.remark 影响下游 3 条列级血缘、2 个指标与 1 张报表，BLOCKER 级变更已自动进入审批门禁', 2, 1, 0, 3, NOW() - INTERVAL 6 HOUR),
('chg-demo-002', @a_customers, 'ods_customers', 'DROP_COLUMN', JSON_OBJECT('column', 'legacy_code', 'oldValue', 'VARCHAR(64)', 'newValue', NULL, 'rawDiff', '- legacy_code VARCHAR(64)  -- 已确认无下游引用'), 'CI_CONTRACT', 0, 1, 'APPROVED', '张架构', 'trace-2b8c44', 'https://git.internal/mr/1024', 'MEDIUM', '删除无下游引用的历史冗余字段，影响面可控，审批通过进入发布窗口', 0, 0, 0, 0, NOW() - INTERVAL 1 DAY),
('chg-demo-003', @a_dws_metrics, 'dws_order_metrics', 'ADD_NULLABLE_COLUMN', JSON_OBJECT('column', 'avg_amount', 'oldValue', NULL, 'newValue', 'DECIMAL(18,2)', 'rawDiff', '+ avg_amount DECIMAL(18,2)  -- 新增 AOV 字段支撑客单价指标'), 'CI_CONTRACT', 0, 1, 'ACK_PENDING', '王指标', 'trace-9d1e07', 'https://git.internal/mr/1031', 'LOW', '新增可空字段支撑 AOV 指标，需下游指标 Owner 确认口径后生效', 1, 1, 0, 1, NOW() - INTERVAL 20 HOUR),
('chg-demo-004', @a_payments, 'ods_payments', 'CHANGE_DATA_TYPE', JSON_OBJECT('column', 'amount', 'oldValue', 'DECIMAL(10,2)', 'newValue', 'DECIMAL(18,2)', 'rawDiff', '~ amount DECIMAL(10,2) -> DECIMAL(18,2)'), 'CDC', 0, 1, 'REJECTED', '李治理', 'trace-5c6f21', NULL, 'HIGH', '扩位金额类型影响支付对账 SQL 显式类型断言，审批评估后驳回，要求先兼容改造', 1, 1, 1, 2, NOW() - INTERVAL 2 DAY),
('chg-demo-005', @a_products, 'ods_products', 'ADD_NULLABLE_COLUMN', JSON_OBJECT('column', 'brand', 'oldValue', NULL, 'newValue', 'VARCHAR(64)', 'rawDiff', '+ brand VARCHAR(64)  -- 商品品牌补录'), 'OPENLINEAGE', 0, 1, 'RESOLVED', '张架构', 'trace-aa0d12', 'https://git.internal/mr/998', 'SAFE', '新增品牌字段用于商品画像，影响面安全，已完成确认闭环', 0, 0, 0, 0, NOW() - INTERVAL 3 DAY),
('chg-demo-006', @a_order_items, 'ods_order_items', 'RENAME_COLUMN', JSON_OBJECT('column', 'qty', 'oldValue', 'qty', 'newValue', 'quantity', 'rawDiff', '~ qty -> quantity  -- 生产库脚本直接执行，未走契约'), 'PROBE', 1, 0, 'DETECTED', '探针', 'trace-drift01', NULL, 'HIGH', '生产库发现未纳管暗改：列改名影响明细加工链路，已阻断并等待反向补录契约', 1, 0, 0, 2, NOW() - INTERVAL 30 MINUTE);

-- ============================================================================
-- 9) 审批流水（发布门禁审计轨迹）
-- ============================================================================
INSERT INTO approval_records (id, change_id, action, actor, comment, decided_at) VALUES
('apr-demo-001', 'chg-demo-001', 'SUBMIT', '自动门禁', '影响面评估为 BLOCKER，自动提交发布审批', NOW() - INTERVAL 6 HOUR),
('apr-demo-002', 'chg-demo-002', 'SUBMIT', '自动门禁', '影响面评估为 MEDIUM，自动提交发布审批', NOW() - INTERVAL 1 DAY),
('apr-demo-003', 'chg-demo-002', 'APPROVE', '张架构', '已核对下游无引用，批准发布', NOW() - INTERVAL 20 HOUR),
('apr-demo-004', 'chg-demo-004', 'SUBMIT', '自动门禁', '影响面评估为 HIGH，自动提交发布审批', NOW() - INTERVAL 2 DAY),
('apr-demo-005', 'chg-demo-004', 'REJECT', '李治理', '对账 SQL 存在显式类型断言，需先完成兼容改造再发布', NOW() - INTERVAL 45 HOUR);

-- ============================================================================
-- 10) 通知（变更/审批/质量事件）
-- ============================================================================
INSERT INTO notifications (id, severity, title, body, ref_type, ref_id, `read`, timestamp, actions) VALUES
('ntf-demo-001', 'CRITICAL', '变更待审批：ods_orders', '删除 remark 字段影响面为 BLOCKER，已进入发布审批门禁，等待审批决策', 'CHANGE_EVENT', 'chg-demo-001', 0, NOW() - INTERVAL 6 HOUR, JSON_ARRAY(JSON_OBJECT('label', '去审批', 'tab', 'changes'))),
('ntf-demo-002', 'HIGH', '变更已驳回：ods_payments', '金额类型扩位变更被驳回：对账 SQL 存在显式类型断言，需先兼容改造', 'CHANGE_EVENT', 'chg-demo-004', 0, NOW() - INTERVAL 45 HOUR, JSON_ARRAY(JSON_OBJECT('label', '查看详情', 'tab', 'changes'))),
('ntf-demo-003', 'HIGH', '变更已批准发布：ods_customers', 'legacy_code 删除已获批准，可进入发布窗口执行', 'CHANGE_EVENT', 'chg-demo-002', 1, NOW() - INTERVAL 20 HOUR, JSON_ARRAY()),
('ntf-demo-004', 'WARN', '未纳管暗改阻断：ods_order_items', '生产库发现 qty -> quantity 列改名暗改，已阻断并等待反向补录契约', 'DARK_CHANGE', 'chg-demo-006', 0, NOW() - INTERVAL 30 MINUTE, JSON_ARRAY(JSON_OBJECT('label', '补录契约', 'tab', 'changes'))),
('ntf-demo-005', 'WARN', '质量违规：金额单位不一致', 'ods_order_items.unit_price 疑似以分存储，已创建 P0 质量问题并指派交易域', 'VALIDATION_FAIL', 'qis-demo-001', 0, NOW() - INTERVAL 12 HOUR, JSON_ARRAY(JSON_OBJECT('label', '查看质量问题', 'tab', 'validation')));

-- 完成提示
SELECT '完整功能测试数据集加载完成' AS status,
       (SELECT COUNT(*) FROM data_standards) AS standards,
       (SELECT COUNT(*) FROM glossary_terms) AS glossary,
       (SELECT COUNT(*) FROM reference_codes) AS codes,
       (SELECT COUNT(*) FROM contracts) AS contracts,
       (SELECT COUNT(*) FROM metrics) AS metrics,
       (SELECT COUNT(*) FROM validation_rules) AS rules,
       (SELECT COUNT(*) FROM quality_issues) AS issues,
       (SELECT COUNT(*) FROM change_events) AS changes,
       (SELECT COUNT(*) FROM approval_records) AS approvals,
       (SELECT COUNT(*) FROM notifications) AS notifications;
