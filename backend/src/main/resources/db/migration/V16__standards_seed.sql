-- V16__standards_seed.sql
-- M12 标准中枢种子（评估报告差距：数据标准无自动落标，三表空态无可校验数据）。
-- 命名标准按当前资产命名分布设计（ODS/DWD/DWS/ADS/APP 前缀体系 + metric: 指标体系），
-- 全部 PUBLISHED 状态且可被 Pattern.matches 全串命中；后续新增不合规资产将由
-- 采集后自动落标与 POST /standards/naming-check 生成质量问题。

INSERT IGNORE INTO data_standards
(id, code, name, type, domain, rule_expr, description, example, severity, status, version, owner, hit_count)
VALUES
('std:nam-001', 'STD-NAM-001', 'ODS 层表名前缀规范', 'NAMING', 'ODS', '^ods_[a-z0-9_]+$',
 'ODS 原始层物理表名统一使用 ods_ 前缀 + 小写蛇形命名（snake_case），禁止大写与驼峰。',
 '正例：ods_orders / ods_customers；反例：OdsOrders / orders_raw', 'P2', 'PUBLISHED', 'v1.0', '王慧 (数据治理组)', 0),
('std:nam-002', 'STD-NAM-002', 'DWD 层表名前缀规范', 'NAMING', 'DWD', '^dwd_[a-z0-9_]+$',
 'DWD 明细层表名统一使用 dwd_ 前缀 + 小写蛇形命名，业务实体顺序为 域_实体_粒度。',
 '正例：dwd_orders / dwd_order_detail；反例：detail_orders / dwdOrder', 'P2', 'PUBLISHED', 'v1.0', '王慧 (数据治理组)', 0),
('std:nam-003', 'STD-NAM-003', 'DWS 层表名前缀规范', 'NAMING', 'DWS', '^dws_[a-z0-9_]+$',
 'DWS 汇总层表名统一使用 dws_ 前缀 + 小写蛇形命名，聚合表以 _summary/_daily/_metrics/_ranking 等粒度后缀结尾。',
 '正例：dws_order_daily / dws_customer_summary；反例：order_daily_agg / DWS_customer', 'P2', 'PUBLISHED', 'v1.0', '王慧 (数据治理组)', 0),
('std:nam-004', 'STD-NAM-004', 'ADS 层表名前缀规范', 'NAMING', 'ADS', '^ads_[a-z0-9_]+$',
 'ADS 应用层结果表名统一使用 ads_ 前缀 + 小写蛇形命名，以 _dashboard/_overview/_360 等消费场景词结尾。',
 '正例：ads_sales_dashboard / ads_customer_360；反例：sales_ads / AdsSales', 'P2', 'PUBLISHED', 'v1.0', '王慧 (数据治理组)', 0),
('std:nam-005', 'STD-NAM-005', '应用与指标资产命名规范', 'NAMING', 'APP', '^(app_[a-z0-9_]+|metric:[a-z0-9_]+)$',
 'APP 应用资产使用 app_ 前缀 + 小写蛇形命名；指标资产使用 metric: 前缀 + 小写蛇形编码，两者互不混用。',
 '正例：app_sales_dashboard / metric:gmv_30d；反例：APP_kpi / metric-GMV', 'P2', 'PUBLISHED', 'v1.0', '王慧 (数据治理组)', 0);

-- 业务术语与命名词根（发布态，供 M12 词汇表页签展示与建模引用）
INSERT IGNORE INTO glossary_terms
(id, term, abbr, category, domain, synonyms, definition, status, version, owner)
VALUES
('term:customer', '客户', 'customer', 'BUSINESS', '客户域', '["用户","cust"]',
 '与平台发生交易或注册关系的自然人/组织实体；ODS 层 ods_customers 为其落地表，主键 customer_id。',
 'PUBLISHED', 'v1.0', '林浩然 (数据架构组)'),
('term:order', '订单', 'order', 'BUSINESS', '交易域', '["单据","交易单"]',
 '客户下单形成的交易凭证，承载金额（amount）与状态机（CREATED→PAID→SHIPPED→COMPLETED/REFUNDED）；ODS 层 ods_orders 为其落地表。',
 'PUBLISHED', 'v1.0', '李博 (交易研发组)'),
('term:gmv', '商品交易总额', 'gmv', 'ROOT', '交易域', '["成交总额"]',
 'Gross Merchandise Volume，统计周期内成交订单金额总和（口径排除已退款订单）；指标编码 metric:gmv_30d。',
 'PUBLISHED', 'v1.0', '赵静 (指标治理组)');

-- 参考数据（编码字典，供 M12 参考码页签与契约状态枚举对齐）
INSERT IGNORE INTO reference_codes
(id, code_set, set_name, code_value, meaning, sort_order, description, status)
VALUES
('rc:os-created', 'ORDER_STATUS', '订单状态', 'CREATED', '已创建（待支付）', 10, '下单成功、尚未支付', 'ACTIVE'),
('rc:os-paid', 'ORDER_STATUS', '订单状态', 'PAID', '已支付', 20, '支付成功、待履约', 'ACTIVE'),
('rc:os-shipped', 'ORDER_STATUS', '订单状态', 'SHIPPED', '已发货', 30, '出库完成、待签收', 'ACTIVE'),
('rc:os-completed', 'ORDER_STATUS', '订单状态', 'COMPLETED', '已完成', 40, '签收完成、交易关闭', 'ACTIVE'),
('rc:os-refunded', 'ORDER_STATUS', '订单状态', 'REFUNDED', '已退款', 50, '退货退款完成', 'ACTIVE'),
('rc:pm-alipay', 'PAYMENT_METHOD', '支付方式', 'ALIPAY', '支付宝', 10, '第三方支付渠道', 'ACTIVE'),
('rc:pm-wechat', 'PAYMENT_METHOD', '支付方式', 'WECHAT', '微信支付', 20, '第三方支付渠道', 'ACTIVE'),
('rc:pm-unionpay', 'PAYMENT_METHOD', '支付方式', 'UNIONPAY', '云闪付', 30, '银联渠道', 'ACTIVE'),
('rc:pm-card', 'PAYMENT_METHOD', '支付方式', 'CARD', '银行卡', 40, '银行卡直连渠道', 'ACTIVE');
