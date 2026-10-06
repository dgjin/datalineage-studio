-- V11__metric_seed.sql
-- M5 指标中心种子数据：指标定义与真实资产/物理字段强绑定，
-- 并生成 METRIC 类型资产 + METRIC_REF 血缘边，支撑「探索该指标图谱」字段级穿透。

-- 1) 指标定义（6 项：原子/复合、跨口径体系、含 DRAFT 未落标样本）
INSERT IGNORE INTO metrics
  (code, name, type, caliber_summary, entity, measure_expr, filter_conditions, dimensions,
   unit, calc_type, frequency, caliber_system, owner, status, version, upstream_metrics,
   referenced_columns, downstream_reports, last_modified)
VALUES
('MET-TRD-GMV-001', '近30天累计有效成交规模', 'ATOMIC',
 '成功结算的订单总金额（GMV），剔除退款退单及测试交易，滚动近 30 个自然日。',
 '交易单 (TRADE_ORDER)', 'SUM(gmv)',
 '["order_status != ''REFUNDED''", "metric_date >= CURRENT_DATE - INTERVAL 30 DAY"]',
 '["统计日期", "业务线"]',
 '万元 (CNY)', 'PERIOD', 'DAILY', 'PBOC',
 '李博 (交易研发组)', 'PUBLISHED', 'v1.2', NULL,
 '[{"assetId":"asset:dl_demo.dws_order_metrics","assetName":"dws_order_metrics","columnName":"gmv","confidence":100}]',
 '["财务结算月结单", "实时交易监控大屏"]', '2026-09-20 09:15:00'),

('MET-TRD-ORD-010', '近30天有效订单笔数', 'ATOMIC',
 '滚动近 30 个自然日内完成支付的有效订单笔数，按 metric_date 汇总。',
 '交易单 (TRADE_ORDER)', 'SUM(order_cnt)',
 '["metric_date >= CURRENT_DATE - INTERVAL 30 DAY"]',
 '["统计日期"]',
 '笔', 'PERIOD', 'DAILY', 'INTERNAL',
 '李博 (交易研发组)', 'PUBLISHED', 'v1.1', NULL,
 '[{"assetId":"asset:dl_demo.dws_order_metrics","assetName":"dws_order_metrics","columnName":"order_cnt","confidence":100},'
 '{"assetId":"asset:dl_demo.dws_order_metrics","assetName":"dws_order_metrics","columnName":"metric_date","confidence":90}]',
 '["商品销售排行看板"]', '2026-09-18 16:40:00'),

('MET-CRM-ACT-001', '当期有效活跃客户数', 'COMPOSITE',
 '统计自然月内发生至少 1 笔有效交易且成交金额大于 0 的独立实名客户总数。',
 '客户 (CUSTOMER)', 'COUNT(DISTINCT customer_id)',
 '["order_cnt >= 1", "total_amount > 0"]',
 '["获客渠道", "价值分层"]',
 '人 (户)', 'PERIOD', 'MONTHLY', 'INTERNAL',
 '林峰 (指标主管)', 'PUBLISHED', 'v2.1',
 '["MET-TRD-ORD-010"]',
 '[{"assetId":"asset:dl_demo.dws_customer_value","assetName":"dws_customer_value","columnName":"customer_id","confidence":100},'
 '{"assetId":"asset:dl_demo.dws_customer_value","assetName":"dws_customer_value","columnName":"order_cnt","confidence":95},'
 '{"assetId":"asset:dl_demo.dws_customer_value","assetName":"dws_customer_value","columnName":"total_amount","confidence":92}]',
 '["经营分析月报", "零售业务高管驾驶舱", "客户全景CRM看板"]', '2026-09-28 15:30:00'),

('MET-CRM-VIP-002', 'VIP高净值客户占比', 'COMPOSITE',
 '当前客户中价值分层为 VIP 及以上的客户数量占比，反映高净值客群结构。',
 '高价值客户 (VIP_CUSTOMER)', 'SUM(CASE WHEN value_tier IN (''VIP'', ''SVIP'') THEN 1 ELSE 0 END) / COUNT(*)',
 '[]',
 '["价值分层"]',
 '%', 'POINT_IN_TIME', 'MONTHLY', 'AMC_EAST',
 '周宏 (营销分析组)', 'PUBLISHED', 'v1.4',
 '["MET-CRM-ACT-001"]',
 '[{"assetId":"asset:dl_demo.dws_customer_value","assetName":"dws_customer_value","columnName":"value_tier","confidence":99},'
 '{"assetId":"asset:dl_demo.dws_customer_value","assetName":"dws_customer_value","columnName":"customer_id","confidence":95}]',
 '["财富客户经营分析", "理财经理KPI考核表"]', '2026-09-25 14:00:00'),

('MET-PAY-SUC-004', '支付成功率', 'ATOMIC',
 '支付成功笔数占全部支付尝试笔数的比例，按支付明细粒度统计。',
 '支付单 (PAYMENT)', 'SUM(CASE WHEN pay_state = ''SUCCESS'' THEN 1 ELSE 0 END) / COUNT(*)',
 '[]',
 '["支付方式"]',
 '%', 'PERIOD', 'DAILY', 'INTERNAL',
 '王倩 (支付平台组)', 'IN_REVIEW', 'v1.0', NULL,
 '[{"assetId":"asset:dl_demo.dwd_payment_detail","assetName":"dwd_payment_detail","columnName":"pay_state","confidence":100},'
 '{"assetId":"asset:dl_demo.dwd_payment_detail","assetName":"dwd_payment_detail","columnName":"pay_amount","confidence":90}]',
 '["实时交易监控大屏"]', '2026-10-02 11:20:00'),

('MET-CUS-VAL-006', '客户价值分层分布', 'COMPOSITE',
 '按价值分层统计客户数量分布占比，口径细化中：分层阈值待客户经营部最终确认。',
 '客户 (CUSTOMER)', 'COUNT(*) GROUP BY value_tier',
 '[]',
 '["价值分层"]',
 '%', 'POINT_IN_TIME', 'MONTHLY', 'INTERNAL',
 '陈晨 (客户经营部)', 'DRAFT', 'v0.1',
 '["MET-CRM-ACT-001"]',
 '[]',
 '[]', '2026-10-05 17:50:00');

-- 2) 口径版本演进历史（含 2 处口径断点，驱动历史数据可比性告警）
INSERT IGNORE INTO metric_history (metric_code, version, diff, breaking_history_data, created_at) VALUES
('MET-TRD-GMV-001', 'v1.0', 'Initial creation', FALSE, '2026-03-01 10:00:00'),
('MET-TRD-GMV-001', 'v1.1', '剔除退款退单交易（REFUNDED），收紧有效成交口径。', FALSE, '2026-06-15 14:20:00'),
('MET-TRD-GMV-001', 'v1.2', '口径断点：剔除测试环境灌入的测试交易金额，历史数据不可直接横向对比。', TRUE, '2026-09-20 09:15:00'),
('MET-TRD-ORD-010', 'v1.0', 'Initial creation', FALSE, '2026-03-01 10:05:00'),
('MET-TRD-ORD-010', 'v1.1', '增加滚动 30 天窗口约束 metric_date >= CURRENT_DATE - 30。', FALSE, '2026-09-18 16:40:00'),
('MET-CRM-ACT-001', 'v2.0', '引入有效成交判断：order_cnt >= 1 且 total_amount > 0。', FALSE, '2026-06-01 11:30:00'),
('MET-CRM-ACT-001', 'v2.1', '口径断点：以 total_amount > 0 替代 order_cnt > 0，剔除 0 元赠品试用单。', TRUE, '2026-09-28 15:30:00'),
('MET-CRM-VIP-002', 'v1.4', '分层阈值对齐客户经营部 2026 版价值分层标准。', FALSE, '2026-09-25 14:00:00'),
('MET-PAY-SUC-004', 'v1.0', 'Initial creation', FALSE, '2026-10-02 11:20:00'),
('MET-CUS-VAL-006', 'v0.1', '初始草案：分层阈值待客户经营部确认。', FALSE, '2026-10-05 17:50:00');

-- 3) 指标资产（type=METRIC，layer=APP），ID 与 M5「探索该指标图谱」链路一致
INSERT IGNORE INTO assets
  (id, code, name, display_title, type, layer, space, owner, department, status,
   description, confidence, source_type, downstream_count, upstream_count, is_managed,
   tags, storage_format)
VALUES
('asset:metric:met-trd-gmv-001', 'METRIC-MET-TRD-GMV-001', 'metric:gmv_30d', '近30天累计有效成交规模',
 'METRIC', 'APP', 'demo', '李博 (交易研发组)', '数据平台部', 'ACTIVE',
 '成功结算的订单总金额（GMV），剔除退款退单及测试交易，滚动近 30 个自然日。',
 100, 'CONTRACT', 0, 0, TRUE, '["业务核心指标", "监管报送"]', '指标引擎计算'),
('asset:metric:met-trd-ord-010', 'METRIC-MET-TRD-ORD-010', 'metric:order_cnt_30d', '近30天有效订单笔数',
 'METRIC', 'APP', 'demo', '李博 (交易研发组)', '数据平台部', 'ACTIVE',
 '滚动近 30 个自然日内完成支付的有效订单笔数，按 metric_date 汇总。',
 100, 'CONTRACT', 0, 0, TRUE, '["业务核心指标"]', '指标引擎计算'),
('asset:metric:met-crm-act-001', 'METRIC-MET-CRM-ACT-001', 'metric:active_customer_cnt', '当期有效活跃客户数',
 'METRIC', 'APP', 'demo', '林峰 (指标主管)', '数据治理与指标委员会', 'ACTIVE',
 '统计自然月内发生至少 1 笔有效交易且成交金额大于 0 的独立实名客户总数。',
 100, 'CONTRACT', 0, 0, TRUE, '["北极星指标", "客户全景"]', '指标引擎计算'),
('asset:metric:met-crm-vip-002', 'METRIC-MET-CRM-VIP-002', 'metric:vip_customer_ratio', 'VIP高净值客户占比',
 'METRIC', 'APP', 'demo', '周宏 (营销分析组)', '财富管理部', 'ACTIVE',
 '当前客户中价值分层为 VIP 及以上的客户数量占比，反映高净值客群结构。',
 100, 'CONTRACT', 0, 0, TRUE, '["业务核心指标", "季度考核"]', '指标引擎计算'),
('asset:metric:met-pay-suc-004', 'METRIC-MET-PAY-SUC-004', 'metric:payment_success_rate', '支付成功率',
 'METRIC', 'APP', 'demo', '王倩 (支付平台组)', '支付平台部', 'ACTIVE',
 '支付成功笔数占全部支付尝试笔数的比例，按支付明细粒度统计。',
 100, 'CONTRACT', 0, 0, TRUE, '["稳定性指标"]', '指标引擎计算'),
('asset:metric:met-cus-val-006', 'METRIC-MET-CUS-VAL-006', 'metric:customer_value_dist', '客户价值分层分布',
 'METRIC', 'APP', 'demo', '陈晨 (客户经营部)', '客户经营部', 'DRAFT',
 '按价值分层统计客户数量分布占比，口径细化中：分层阈值待客户经营部最终确认。',
 90, 'CONTRACT', 0, 0, TRUE, '["草案指标"]', '指标引擎计算');

-- 4) METRIC_REF 血缘边：物理表 → 指标（DRAFT 未落标指标无绑定边）
INSERT IGNORE INTO lineage_edges
  (id, from_asset_id, to_asset_id, from_column, to_column, kind, source, confidence, transform_expr, is_critical_path, valid_from)
VALUES
('edge:metricref:met-trd-gmv-001', 'asset:dl_demo.dws_order_metrics', 'asset:metric:met-trd-gmv-001',
 NULL, NULL, 'METRIC_REF', 'CONTRACT', 100, NULL, FALSE, '2026-09-30 19:00:00'),
('edge:metricref:met-trd-ord-010', 'asset:dl_demo.dws_order_metrics', 'asset:metric:met-trd-ord-010',
 NULL, NULL, 'METRIC_REF', 'CONTRACT', 100, NULL, FALSE, '2026-09-30 19:00:00'),
('edge:metricref:met-crm-act-001', 'asset:dl_demo.dws_customer_value', 'asset:metric:met-crm-act-001',
 NULL, NULL, 'METRIC_REF', 'CONTRACT', 100, NULL, FALSE, '2026-09-30 19:00:00'),
('edge:metricref:met-crm-vip-002', 'asset:dl_demo.dws_customer_value', 'asset:metric:met-crm-vip-002',
 NULL, NULL, 'METRIC_REF', 'CONTRACT', 95, NULL, FALSE, '2026-09-30 19:00:00'),
('edge:metricref:met-pay-suc-004', 'asset:dl_demo.dwd_payment_detail', 'asset:metric:met-pay-suc-004',
 NULL, NULL, 'METRIC_REF', 'CONTRACT', 100, NULL, FALSE, '2026-09-30 19:00:00');

-- 5) 全量重算去规范化计数与关键路径标记（与运行时 refreshAssetCounts 逻辑一致）
UPDATE assets a
SET downstream_count = (SELECT COUNT(*) FROM lineage_edges e WHERE e.from_asset_id = a.id),
    upstream_count = (SELECT COUNT(*) FROM lineage_edges e WHERE e.to_asset_id = a.id);

UPDATE lineage_edges e
JOIN assets fa ON e.from_asset_id = fa.id
JOIN assets ta ON e.to_asset_id = ta.id
SET e.is_critical_path = (fa.layer <> ta.layer);
