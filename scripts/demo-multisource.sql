-- ============================================================================
-- demo-multisource.sql — 多数据源分层导入演示：数仓层 + 应用层两个独立库
--
-- 配合 scripts/switch-demo.sh multisource 使用：
--   dl_demo      (数据源: 本地测试MySQL)   = ODS 贴源层
--   dw_warehouse (数据源: 数仓层MySQL)     = DWD + DWS
--   dw_app       (数据源: 应用层MySQL)     = ADS + APP
--
-- 表名按层前缀规范命名（dwd_/dws_/ads_/app_），跨源关系：
--   ODS→DWD 同名匹配(orders/customers)、DWD→DWS ETL解析、
--   DWS→ADS ETL解析、ADS→APP 同名匹配
--
-- 幂等：DROP DATABASE + 重建（重复执行安全）
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 数仓层库：DWD + DWS
-- ---------------------------------------------------------------------------
DROP DATABASE IF EXISTS dw_warehouse;
CREATE DATABASE dw_warehouse DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE dw_warehouse;

-- DWD 明细层：订单明细事实表（业务名 orders ↔ ods_orders）
CREATE TABLE dwd_orders (
  order_id BIGINT NOT NULL COMMENT '订单ID',
  customer_id BIGINT DEFAULT NULL COMMENT '客户ID',
  status VARCHAR(32) DEFAULT NULL COMMENT '订单状态',
  total_amount DECIMAL(12,2) DEFAULT NULL COMMENT '订单金额',
  created_at DATETIME DEFAULT NULL COMMENT '下单时间',
  PRIMARY KEY (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细事实表（DWD，清洗自 ODS）';

-- DWD 明细层：客户维度表（业务名 customers ↔ ods_customers）
CREATE TABLE dwd_customers (
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) DEFAULT NULL COMMENT '客户名称',
  tier VARCHAR(16) DEFAULT NULL COMMENT '客户等级',
  region VARCHAR(32) DEFAULT NULL COMMENT '所属区域',
  PRIMARY KEY (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户维度表（DWD，标准化编码）';

-- DWS 汇总层：订单日汇总（ETL 解析自 dwd_orders）
CREATE TABLE dws_order_daily (
  stat_date DATE NOT NULL COMMENT '统计日期',
  order_count INT DEFAULT NULL COMMENT '订单量',
  total_amount DECIMAL(14,2) DEFAULT NULL COMMENT '成交总额',
  PRIMARY KEY (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单日汇总表（DWS）';

-- DWS 汇总层：客户订单汇总（ETL 解析自 dwd_orders）
CREATE TABLE dws_customer_summary (
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  order_total DECIMAL(14,2) DEFAULT NULL COMMENT '累计成交额',
  last_order_at DATETIME DEFAULT NULL COMMENT '最近下单时间',
  PRIMARY KEY (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户订单汇总表（DWS）';

-- 样例数据
INSERT INTO dwd_orders (order_id, customer_id, status, total_amount, created_at) VALUES
  (1001, 101, 'PAID',     299.00, '2026-09-25 10:12:00'),
  (1002, 102, 'PAID',     158.50, '2026-09-25 14:03:00'),
  (1003, 101, 'REFUNDED',  89.00, '2026-09-26 09:30:00'),
  (1004, 103, 'PAID',     420.00, '2026-09-26 20:15:00'),
  (1005, 102, 'PAID',     312.80, '2026-09-27 11:45:00');

INSERT INTO dwd_customers (customer_id, customer_name, tier, region) VALUES
  (101, '张伟', 'VIP',   '华东'),
  (102, '李娜', 'MEDIUM', '华北'),
  (103, '王强', 'VIP',   '华南');

INSERT INTO dws_order_daily (stat_date, order_count, total_amount) VALUES
  ('2026-09-25', 2, 457.50),
  ('2026-09-26', 2, 509.00),
  ('2026-09-27', 1, 312.80);

INSERT INTO dws_customer_summary (customer_id, order_total, last_order_at) VALUES
  (101, 388.00, '2026-09-26 09:30:00'),
  (102, 471.30, '2026-09-27 11:45:00'),
  (103, 420.00, '2026-09-26 20:15:00');

-- ---------------------------------------------------------------------------
-- 应用层库：ADS + APP
-- ---------------------------------------------------------------------------
DROP DATABASE IF EXISTS dw_app;
CREATE DATABASE dw_app DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE dw_app;

-- ADS 应用数据层：销售看板（ETL 解析自 dws_order_daily）
CREATE TABLE ads_sales_dashboard (
  report_date DATE NOT NULL COMMENT '报表日期',
  total_sales DECIMAL(14,2) DEFAULT NULL COMMENT '销售总额',
  order_volume INT DEFAULT NULL COMMENT '订单量',
  PRIMARY KEY (report_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售看板表（ADS）';

-- ADS 应用数据层：客户360视图（ETL 解析自 dws_customer_summary）
CREATE TABLE ads_customer_360 (
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  value_level VARCHAR(16) DEFAULT NULL COMMENT '价值等级',
  total_orders DECIMAL(14,2) DEFAULT NULL COMMENT '累计订单额',
  PRIMARY KEY (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户360视图（ADS）';

-- APP 终端应用层：高管销售大屏（业务名 sales_dashboard ↔ ads_sales_dashboard）
CREATE TABLE app_sales_dashboard (
  report_date DATE NOT NULL COMMENT '大屏日期',
  total_sales DECIMAL(14,2) DEFAULT NULL COMMENT '销售总额',
  PRIMARY KEY (report_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='高管销售大屏数据（APP）';

-- APP 终端应用层：客户360服务（业务名 customer_360 ↔ ads_customer_360）
CREATE TABLE app_customer_360 (
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  value_level VARCHAR(16) DEFAULT NULL COMMENT '价值等级',
  PRIMARY KEY (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户360数据服务（APP）';

-- 样例数据
INSERT INTO ads_sales_dashboard (report_date, total_sales, order_volume) VALUES
  ('2026-09-25', 457.50, 2),
  ('2026-09-26', 509.00, 2),
  ('2026-09-27', 312.80, 1);

INSERT INTO ads_customer_360 (customer_id, value_level, total_orders) VALUES
  (101, 'HIGH',   388.00),
  (102, 'MEDIUM', 471.30),
  (103, 'HIGH',   420.00);

INSERT INTO app_sales_dashboard (report_date, total_sales) VALUES
  ('2026-09-25', 457.50),
  ('2026-09-26', 509.00),
  ('2026-09-27', 312.80);

INSERT INTO app_customer_360 (customer_id, value_level) VALUES
  (101, 'HIGH'),
  (102, 'MEDIUM'),
  (103, 'HIGH');
