-- ============================================================
-- DataLineage Studio —— 演示数据集（零售订单分析链路 · 五层数仓全覆盖）
--
-- 场景：ODS → DWD → DWS → ADS → APP 端到端血缘跟踪
--
--   层      对象                                                     类型
--   ODS     ods_customers / ods_orders / ods_products /              5 表
--           ods_order_items / ods_payments
--   DWD     dwd_order_detail / dwd_customer_orders /                 4 视图
--           dwd_payment_detail / dwd_product_profile
--   DWS     dws_customer_value / dws_product_ranking /               4 视图
--           dws_daily_payment / dws_category_sales
--           dws_order_metrics（物理表，血缘经 OpenLineage 补充）       1 表
--   ADS     ads_sales_overview / ads_customer_dashboard /            3 视图
--           ads_payment_overview
--   APP     app_dashboard_kpi / app_bi_customer_360 /                3 视图
--           app_ops_pay_monitor
--
-- 覆盖能力：
--   1) 五层命名规范（ods_/dwd_/dws_/ads_/app_ 前缀）—— 采集器自动分层
--   2) 列级血缘解析素材（JOIN / LEFT JOIN / 聚合 / 表达式 / CASE WHEN，全部显式别名）
--   3) 外键关系（4 个 FK：orders→customers, order_items→orders/products, payments→orders）
--   4) PII 与中文注释（utf8mb4 会话写入，避免双重编码）
--   5) OpenLineage 运行期血缘演示（ods_orders + ods_order_items → dws_order_metrics）
--
-- 执行方式（必须显式 utf8mb4，否则中文注释双重编码乱码）：
--   docker exec -i dl-mysql-test mysql --default-character-set=utf8mb4 \
--     -uroot -proot123 < scripts/demo-dataset.sql
--
-- 幂等：可重复执行（DROP + CREATE 全量重建，同时清理旧版无前缀命名的对象）。
-- ============================================================
SET NAMES utf8mb4;

-- ---------- 0) 清理（依赖倒序：先视图后表，并清理旧版遗留对象） ----------
DROP VIEW IF EXISTS dl_demo.app_dashboard_kpi;
DROP VIEW IF EXISTS dl_demo.app_bi_customer_360;
DROP VIEW IF EXISTS dl_demo.app_ops_pay_monitor;
DROP VIEW IF EXISTS dl_demo.ads_sales_overview;
DROP VIEW IF EXISTS dl_demo.ads_customer_dashboard;
DROP VIEW IF EXISTS dl_demo.ads_payment_overview;
DROP VIEW IF EXISTS dl_demo.dws_customer_value;
DROP VIEW IF EXISTS dl_demo.dws_product_ranking;
DROP VIEW IF EXISTS dl_demo.dws_daily_payment;
DROP VIEW IF EXISTS dl_demo.dws_category_sales;
DROP VIEW IF EXISTS dl_demo.dwd_order_detail;
DROP VIEW IF EXISTS dl_demo.dwd_customer_orders;
DROP VIEW IF EXISTS dl_demo.dwd_payment_detail;
DROP VIEW IF EXISTS dl_demo.dwd_product_profile;
-- 旧版命名（v_* / 早期试验视图，迁移遗留）
DROP VIEW IF EXISTS dl_demo.order_summary;
DROP VIEW IF EXISTS dl_demo.v_product_ranking;
DROP VIEW IF EXISTS dl_demo.v_customer_value;
DROP VIEW IF EXISTS dl_demo.v_daily_payment;
DROP VIEW IF EXISTS dl_demo.v_customer_orders;
DROP VIEW IF EXISTS dl_demo.v_order_detail;

DROP TABLE IF EXISTS dl_demo.ods_order_items;
DROP TABLE IF EXISTS dl_demo.ods_payments;
DROP TABLE IF EXISTS dl_demo.ods_orders;
DROP TABLE IF EXISTS dl_demo.ods_customers;
DROP TABLE IF EXISTS dl_demo.ods_products;
DROP TABLE IF EXISTS dl_demo.dws_order_metrics;
-- 旧版命名（无前缀表，迁移遗留）
DROP TABLE IF EXISTS dl_demo.payments;
DROP TABLE IF EXISTS dl_demo.order_items;
DROP TABLE IF EXISTS dl_demo.products;
DROP TABLE IF EXISTS dl_demo.orders;
DROP TABLE IF EXISTS dl_demo.customers;

-- ---------- 1) ODS 层：原始业务表 ----------
CREATE TABLE dl_demo.ods_customers (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '客户ID',
    name VARCHAR(50) NOT NULL COMMENT '客户姓名',
    email VARCHAR(100) DEFAULT NULL COMMENT '邮箱（PII）',
    phone VARCHAR(20) DEFAULT NULL COMMENT '手机号（PII）',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户主数据表';

CREATE TABLE dl_demo.ods_orders (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '订单ID',
    customer_id BIGINT NOT NULL COMMENT '客户ID',
    amount DECIMAL(12,2) DEFAULT NULL COMMENT '订单金额',
    status VARCHAR(20) DEFAULT NULL COMMENT '订单状态',
    remark VARCHAR(200) DEFAULT NULL COMMENT '订单备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '下单时间',
    PRIMARY KEY (id),
    KEY idx_order_customer (customer_id),
    CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES dl_demo.ods_customers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单主表';

CREATE TABLE dl_demo.ods_products (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '商品ID',
    product_name VARCHAR(100) NOT NULL COMMENT '商品名称',
    category VARCHAR(50) DEFAULT NULL COMMENT '商品类目',
    price DECIMAL(10,2) DEFAULT NULL COMMENT '标准单价',
    stock INT DEFAULT 0 COMMENT '库存数量',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品主数据表';

CREATE TABLE dl_demo.ods_order_items (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '明细ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    product_id BIGINT NOT NULL COMMENT '商品ID',
    quantity INT NOT NULL DEFAULT 1 COMMENT '购买数量',
    unit_price DECIMAL(10,2) DEFAULT NULL COMMENT '成交单价',
    PRIMARY KEY (id),
    KEY idx_item_order (order_id),
    KEY idx_item_product (product_id),
    CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES dl_demo.ods_orders (id),
    CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES dl_demo.ods_products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表';

CREATE TABLE dl_demo.ods_payments (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '支付流水ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    pay_amount DECIMAL(16,0) DEFAULT NULL COMMENT '支付金额',
    pay_method VARCHAR(20) DEFAULT NULL COMMENT '支付方式',
    pay_status VARCHAR(20) DEFAULT NULL COMMENT '支付状态',
    paid_at DATETIME DEFAULT NULL COMMENT '支付时间',
    PRIMARY KEY (id),
    KEY idx_pay_order (order_id),
    CONSTRAINT fk_pay_order FOREIGN KEY (order_id) REFERENCES dl_demo.ods_orders (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付流水表';

-- DWS 指标表：由外部调度（Airflow/Spark）生成，血缘经 OpenLineage 事件补全
CREATE TABLE dl_demo.dws_order_metrics (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '指标ID',
    metric_date DATE NOT NULL COMMENT '统计日期',
    order_cnt INT DEFAULT NULL COMMENT '订单量',
    gmv DECIMAL(18,2) DEFAULT NULL COMMENT '成交总额',
    avg_amount DECIMAL(10,2) DEFAULT NULL COMMENT '客单价',
    refreshed_at DATETIME DEFAULT NULL COMMENT '刷新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_metric_date (metric_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单指标日汇总表';

-- ---------- 2) 数据 ----------

-- 客户（name / email / phone 为 PII 字段，用于敏感数据流向演示）
INSERT INTO dl_demo.ods_customers (id, name, email, phone) VALUES
(1, '张伟', 'zhangwei@example.com', '13800000001'),
(2, '李娜', 'lina@example.com',     '13800000002'),
(3, '王强', 'wangqiang@example.com','13800000003'),
(4, '赵敏', 'zhaomin@example.com',  '13800000004'),
(5, '陈晨', 'chenchen@example.com', '13800000005'),
(6, '刘洋', 'liuyang@example.com',  '13800000006');

-- 订单
INSERT INTO dl_demo.ods_orders (id, customer_id, amount, status, remark) VALUES
(1001, 1, 2097, 'PAID',      '促销活动订单'),
(1002, 1, 488,  'PAID',      NULL),
(1003, 2, 3098, 'PAID',      '企业采购'),
(1004, 2, 518,  'REFUNDED',  NULL),
(1005, 3, 899,  'PAID',      NULL),
(1006, 3, 1299, 'PAID',      '加急发货'),
(1007, 4, 399,  'CANCELLED', NULL),
(1008, 4, 3498, 'PAID',      NULL),
(1009, 5, 1976, 'PAID',      '会员优惠'),
(1010, 5, 259,  'CREATED',   NULL);

-- 商品
INSERT INTO dl_demo.ods_products (id, product_name, category, price, stock) VALUES
(1, '机械键盘',    '外设',     399.00, 120),
(2, '人体工学椅',  '家具',     1299.00, 30),
(3, '降噪耳机',    '音频',     899.00, 85),
(4, '4K 显示器',   '显示设备', 2199.00, 40),
(5, 'USB-C 扩展坞', '外设',    259.00, 200),
(6, '笔记本支架',  '配件',     89.00, 350);

-- 订单明细（金额与订单一致）
INSERT INTO dl_demo.ods_order_items (order_id, product_id, quantity, unit_price) VALUES
(1001, 2, 1, 1299.00),
(1001, 1, 2, 399.00),
(1002, 1, 1, 399.00),
(1002, 6, 1, 89.00),
(1003, 4, 1, 2199.00),
(1003, 3, 1, 899.00),
(1004, 5, 2, 259.00),
(1005, 3, 1, 899.00),
(1006, 2, 1, 1299.00),
(1007, 1, 1, 399.00),
(1008, 4, 1, 2199.00),
(1008, 2, 1, 1299.00),
(1009, 3, 2, 899.00),
(1009, 6, 2, 89.00),
(1010, 5, 1, 259.00);

-- 支付流水
INSERT INTO dl_demo.ods_payments (order_id, pay_amount, pay_method, pay_status, paid_at) VALUES
(1001, 2097, 'ALIPAY', 'SUCCESS', '2026-09-20 10:12:00'),
(1002, 488,  'WECHAT', 'SUCCESS', '2026-09-20 15:40:00'),
(1003, 3098, 'CARD',   'SUCCESS', '2026-09-21 09:05:00'),
(1004, 518,  'WECHAT', 'REFUNDED','2026-09-21 11:22:00'),
(1005, 899,  'ALIPAY', 'SUCCESS', '2026-09-21 19:30:00'),
(1006, 1299, 'WECHAT', 'SUCCESS', '2026-09-22 08:55:00'),
(1008, 3498, 'CARD',   'SUCCESS', '2026-09-23 14:18:00'),
(1009, 1976, 'ALIPAY', 'SUCCESS', '2026-09-24 20:45:00');

-- DWS 指标数据（ETL 产出，血缘由 OpenLineage 事件补充）
INSERT INTO dl_demo.dws_order_metrics (metric_date, order_cnt, gmv, avg_amount, refreshed_at) VALUES
('2026-09-18', 12, 18650.00, 1554.17, '2026-09-19 02:10:00'),
('2026-09-19', 9,  12300.00, 1366.67, '2026-09-20 02:10:00'),
('2026-09-20', 15, 24780.00, 1652.00, '2026-09-21 02:10:00'),
('2026-09-21', 11, 15900.00, 1445.45, '2026-09-22 02:10:00'),
('2026-09-22', 14, 21360.00, 1525.71, '2026-09-23 02:10:00'),
('2026-09-23', 10, 17800.00, 1780.00, '2026-09-24 02:10:00'),
('2026-09-24', 13, 20150.00, 1550.00, '2026-09-25 02:10:00');

-- ---------- 3) DWD 层：明细与维度加工（1 级视图） ----------

-- DWD：订单明细宽表（3 表 JOIN + 算术表达式）
CREATE VIEW dl_demo.dwd_order_detail AS
SELECT
    o.id            AS order_id,
    o.customer_id   AS customer_id,
    o.status        AS order_status,
    oi.product_id   AS product_id,
    p.product_name  AS product_name,
    p.category      AS category,
    oi.quantity     AS quantity,
    oi.unit_price   AS unit_price,
    (oi.quantity * oi.unit_price) AS line_amount
FROM dl_demo.ods_orders o
JOIN dl_demo.ods_order_items oi ON o.id = oi.order_id
JOIN dl_demo.ods_products p ON oi.product_id = p.id;

-- DWD：客户订单汇总（JOIN + 聚合 + CONCAT 表达式，含 PII 字段流向）
CREATE VIEW dl_demo.dwd_customer_orders AS
SELECT
    c.id     AS customer_id,
    c.name   AS customer_name,
    CONCAT(c.name, '/', IFNULL(c.email, '-')) AS contact,
    COUNT(o.id)   AS order_cnt,
    SUM(o.amount) AS total_amount
FROM dl_demo.ods_customers c
JOIN dl_demo.ods_orders o ON c.id = o.customer_id
GROUP BY c.id, c.name, c.email;

-- DWD：支付明细宽表（JOIN + CASE WHEN 状态标准化）
CREATE VIEW dl_demo.dwd_payment_detail AS
SELECT
    pay.id          AS payment_id,
    pay.order_id    AS order_id,
    o.customer_id   AS customer_id,
    pay.pay_amount  AS pay_amount,
    pay.pay_method  AS pay_method,
    CASE WHEN pay.pay_status = 'SUCCESS' THEN 'PAID'
         WHEN pay.pay_status = 'REFUNDED' THEN 'REFUND'
         ELSE 'PENDING' END AS pay_state,
    pay.paid_at     AS paid_at
FROM dl_demo.ods_payments pay
JOIN dl_demo.ods_orders o ON pay.order_id = o.id;

-- DWD：商品维度档案（单表 + CASE WHEN 价格档位）
CREATE VIEW dl_demo.dwd_product_profile AS
SELECT
    p.id            AS product_id,
    p.product_name  AS product_name,
    p.category      AS category,
    p.price         AS list_price,
    CASE WHEN p.price >= 1000 THEN '高端'
         WHEN p.price >= 300 THEN '中端'
         ELSE '入门' END AS price_band,
    p.stock         AS stock
FROM dl_demo.ods_products p;

-- ---------- 4) DWS 层：主题汇总（2 级视图） ----------

-- DWS：客户价值分层（CASE WHEN 表达式）
CREATE VIEW dl_demo.dws_customer_value AS
SELECT
    customer_id   AS customer_id,
    customer_name AS customer_name,
    order_cnt     AS order_cnt,
    total_amount  AS total_amount,
    CASE WHEN total_amount >= 5000 THEN '高价值'
         WHEN total_amount >= 2000 THEN '潜力'
         ELSE '普通' END AS value_tier
FROM dl_demo.dwd_customer_orders;

-- DWS：商品销售排行（LEFT JOIN 维度 + 聚合）
CREATE VIEW dl_demo.dws_product_ranking AS
SELECT
    d.product_id    AS product_id,
    d.product_name  AS product_name,
    d.category      AS category,
    pf.price_band   AS price_band,
    SUM(d.quantity)    AS total_qty,
    SUM(d.line_amount) AS total_sales
FROM dl_demo.dwd_order_detail d
LEFT JOIN dl_demo.dwd_product_profile pf ON d.product_id = pf.product_id
GROUP BY d.product_id, d.product_name, d.category, pf.price_band;

-- DWS：每日支付汇总（日期函数 + 聚合 + WHERE 过滤）
CREATE VIEW dl_demo.dws_daily_payment AS
SELECT
    DATE(paid_at)     AS pay_date,
    pay_method        AS pay_method,
    COUNT(payment_id) AS txn_cnt,
    SUM(pay_amount)   AS total_pay
FROM dl_demo.dwd_payment_detail
WHERE pay_state = 'PAID'
GROUP BY DATE(paid_at), pay_method;

-- DWS：类目销售汇总（聚合）
CREATE VIEW dl_demo.dws_category_sales AS
SELECT
    category         AS category,
    SUM(quantity)    AS total_qty,
    SUM(line_amount) AS total_sales,
    COUNT(order_id)  AS line_cnt
FROM dl_demo.dwd_order_detail
GROUP BY category;

-- ---------- 5) ADS 层：面向业务的指标集（3 级视图） ----------

-- ADS：类目销售评级总览
CREATE VIEW dl_demo.ads_sales_overview AS
SELECT
    category    AS category,
    total_qty   AS total_qty,
    total_sales AS total_sales,
    line_cnt    AS line_cnt,
    CASE WHEN total_sales >= 5000 THEN 'A'
         WHEN total_sales >= 2000 THEN 'B'
         ELSE 'C' END AS sales_grade
FROM dl_demo.dws_category_sales;

-- ADS：客户价值看板
CREATE VIEW dl_demo.ads_customer_dashboard AS
SELECT
    customer_id   AS customer_id,
    customer_name AS customer_name,
    order_cnt     AS order_cnt,
    total_amount  AS total_amount,
    value_tier    AS value_tier,
    CASE WHEN value_tier = '高价值' THEN 1 ELSE 0 END AS is_vip
FROM dl_demo.dws_customer_value;

-- ADS：支付监控总览
CREATE VIEW dl_demo.ads_payment_overview AS
SELECT
    pay_date   AS pay_date,
    pay_method AS pay_method,
    txn_cnt    AS txn_cnt,
    total_pay  AS total_pay,
    CASE WHEN total_pay >= 3000 THEN '高'
         WHEN total_pay >= 1000 THEN '中'
         ELSE '低' END AS pay_level
FROM dl_demo.dws_daily_payment;

-- ---------- 6) APP 层：应用消费视图（4 级视图，端到端贯通终点） ----------

-- APP：首页核心 KPI 卡片
CREATE VIEW dl_demo.app_dashboard_kpi AS
SELECT
    category    AS kpi_name,
    total_sales AS kpi_value,
    sales_grade AS kpi_grade
FROM dl_demo.ads_sales_overview;

-- APP：BI 客户 360 画像
CREATE VIEW dl_demo.app_bi_customer_360 AS
SELECT
    customer_id   AS customer_id,
    customer_name AS customer_name,
    total_amount  AS lifetime_value,
    value_tier    AS value_tier,
    is_vip        AS is_vip
FROM dl_demo.ads_customer_dashboard;

-- APP：支付运营监控面板
CREATE VIEW dl_demo.app_ops_pay_monitor AS
SELECT
    pay_date   AS pay_date,
    pay_method AS pay_method,
    total_pay  AS total_pay,
    pay_level  AS pay_level
FROM dl_demo.ads_payment_overview;

-- ============================================================
-- 可选：变更演示（手动执行后重跑采集任务，M4 变更中心将出现事件）
--   ALTER TABLE dl_demo.ods_orders ADD COLUMN channel VARCHAR(20) DEFAULT 'APP' COMMENT '下单渠道';
--   ALTER TABLE dl_demo.ods_orders MODIFY COLUMN remark VARCHAR(500) COMMENT '订单备注';
-- ============================================================
