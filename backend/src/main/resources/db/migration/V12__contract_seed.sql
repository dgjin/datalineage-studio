-- V12__contract_seed.sql
-- M6 契约浏览器种子数据：4 份契约与真实资产绑定（YAML 内声明 assetId 锚点，
-- 驱动「CI 影响预演」跳转真实资产与 CI 检查面板动态化）。

INSERT IGNORE INTO contracts (id, path, domain, version, author, status, yaml_content, generated_ddl, last_updated)
VALUES
('contract:demo.ods_orders', 'contracts/demo/ods_orders.yaml', 'demo', 'v2.0', '李博 (交易研发组)', 'MERGED',
'# ==============================================================
# 数据契约声明 (Data Contract Specification v2.0)
# 域：demo | 实体：ods_orders | 状态：ACTIVE
# ==============================================================
schemaVersion: 2.0
dataset: ods_orders
assetId: asset:dl_demo.ods_orders
domain: demo
owner: libo@company.com
team: trade_platform_group
storageEngine: mysql
updateFrequency: realtime_cdc

columns:
  - name: id
    type: BIGINT
    primaryKey: true
    nullable: false
    description: 订单唯一标识符
    sensitivity: INTERNAL

  - name: customer_id
    type: BIGINT
    nullable: false
    description: 下单客户ID（关联 ods_customers）
    sensitivity: INTERNAL

  - name: amount
    type: DECIMAL(12,2)
    nullable: true
    description: 订单金额（元）
    sensitivity: INTERNAL

  - name: status
    type: VARCHAR(20)
    nullable: true
    description: 订单状态：CREATED/PAID/SHIPPED/COMPLETED/REFUNDED
    sensitivity: INTERNAL

  - name: created_at
    type: DATETIME
    nullable: true
    description: 订单创建时间

  - name: remark
    type: VARCHAR(200)
    nullable: true
    description: 备注
',
'CREATE TABLE IF NOT EXISTS ods_orders (
    id BIGINT NOT NULL COMMENT ''订单唯一标识符'',
    customer_id BIGINT NOT NULL COMMENT ''下单客户ID'',
    amount DECIMAL(12,2) NULL COMMENT ''订单金额（元）'',
    status VARCHAR(20) NULL COMMENT ''订单状态'',
    created_at DATETIME NULL COMMENT ''订单创建时间'',
    remark VARCHAR(200) NULL COMMENT ''备注'',
    PRIMARY KEY (id)
);',
'2026-09-29 16:20:00'),

('contract:demo.dwd_order_detail', 'contracts/demo/dwd_order_detail.yaml', 'demo', 'v1.3', '李博 (交易研发组)', 'MERGED',
'# ==============================================================
# 数据契约声明 (Data Contract Specification v2.0)
# 域：demo | 实体：dwd_order_detail | 类型：DWD 视图
# ==============================================================
schemaVersion: 2.0
dataset: dwd_order_detail
assetId: asset:dl_demo.dwd_order_detail
domain: demo
owner: libo@company.com
team: trade_platform_group
storageEngine: mysql
updateFrequency: hourly

columns:
  - name: order_id
    type: BIGINT
    nullable: false
    description: 订单ID（源：ods_orders.id）

  - name: customer_id
    type: BIGINT
    nullable: false
    description: 客户ID

  - name: product_id
    type: BIGINT
    nullable: false
    description: 商品ID

  - name: product_name
    type: VARCHAR(100)
    nullable: true
    description: 商品名称

  - name: category
    type: VARCHAR(50)
    nullable: true
    description: 商品分类

  - name: quantity
    type: INT
    nullable: true
    description: 购买数量

  - name: unit_price
    type: DECIMAL(10,2)
    nullable: true
    description: 成交单价

  - name: line_amount
    type: DECIMAL(20,2)
    nullable: true
    description: 明细行金额 = quantity * unit_price

  - name: order_status
    type: VARCHAR(20)
    nullable: true
    description: 订单状态
',
'CREATE OR REPLACE VIEW dwd_order_detail AS
SELECT
    o.id AS order_id,
    o.customer_id,
    oi.product_id,
    p.product_name,
    p.category,
    oi.quantity,
    oi.unit_price,
    (oi.quantity * oi.unit_price) AS line_amount,
    o.status AS order_status
FROM ods_orders o
JOIN ods_order_items oi ON o.id = oi.order_id
JOIN ods_products p ON oi.product_id = p.id;',
'2026-09-29 17:05:00'),

('contract:warehouse.dws_customer_summary', 'contracts/warehouse/dws_customer_summary.yaml', 'warehouse', 'v1.1', '赵静 (数仓架构组)', 'IN_REVIEW',
'# ==============================================================
# 数据契约声明 (Data Contract Specification v2.0)
# 域：warehouse | 实体：dws_customer_summary | 状态：评审中
# 变更点：新增 last_order_at 最近下单时间字段（待下游 Ack）
# ==============================================================
schemaVersion: 2.0
dataset: dws_customer_summary
assetId: asset:dw_warehouse.dws_customer_summary
domain: warehouse
owner: zhaojing@company.com
team: dw_architecture_group
storageEngine: mysql
updateFrequency: daily

columns:
  - name: customer_id
    type: BIGINT
    primaryKey: true
    nullable: false
    description: 客户唯一标识符
    sensitivity: INTERNAL

  - name: order_total
    type: DECIMAL(14,2)
    nullable: true
    description: 客户累计成交金额
    sensitivity: INTERNAL

  - name: last_order_at
    type: DATETIME
    nullable: true
    description: 最近一次下单时间（v1.1 新增）
',
'CREATE TABLE IF NOT EXISTS dws_customer_summary (
    customer_id BIGINT NOT NULL,
    order_total DECIMAL(14,2) NULL COMMENT ''客户累计成交金额'',
    last_order_at DATETIME NULL COMMENT ''最近一次下单时间'',
    PRIMARY KEY (customer_id)
);',
'2026-10-04 10:15:00'),

('contract:app.ads_sales_dashboard', 'contracts/app/ads_sales_dashboard.yaml', 'app', 'v1.0', '孙悦 (BI 团队)', 'MERGED',
'# ==============================================================
# 数据契约声明 (Data Contract Specification v2.0)
# 域：app | 实体：ads_sales_dashboard | 类型：应用层看板表
# ==============================================================
schemaVersion: 2.0
dataset: ads_sales_dashboard
assetId: asset:dw_app.ads_sales_dashboard
domain: app
owner: sunyue@company.com
team: bi_analytics_group
storageEngine: mysql
updateFrequency: daily

columns:
  - name: report_date
    type: DATE
    primaryKey: true
    nullable: false
    description: 统计日期

  - name: total_sales
    type: DECIMAL(14,2)
    nullable: true
    description: 当日销售额（元）

  - name: order_volume
    type: INT
    nullable: true
    description: 当日订单量

  - name: conversion_rate
    type: DECIMAL(6,4)
    nullable: true
    description: 当日下单转化率（0-1 之间）
    sensitivity: INTERNAL
',
'CREATE TABLE IF NOT EXISTS ads_sales_dashboard (
    report_date DATE NOT NULL COMMENT ''统计日期'',
    total_sales DECIMAL(14,2) NULL COMMENT ''当日销售额'',
    order_volume INT NULL COMMENT ''当日订单量'',
    conversion_rate DECIMAL(6,4) NULL COMMENT ''当日下单转化率'',
    PRIMARY KEY (report_date)
);',
'2026-09-30 09:40:00');
