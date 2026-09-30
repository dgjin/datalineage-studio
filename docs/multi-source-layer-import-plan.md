# 多数据源分层导入与跨源血缘关系方案

> 需求：ODS → DWD、DWS、ADS、APP 各层数据分别位于不同数据源，支持从各自数据源独立导入（采集），
> 并建立层与层之间可追溯的血缘关系。

## 1. 边界定义

本平台是**血缘治理平台**，不是 ETL 执行引擎。"从不同数据源导入"在本方案中定义为两层含义：

| 层次 | 含义 | 本平台职责 |
| :--- | :--- | :--- |
| 元数据导入 | 从各层各自的数据源采集表结构、字段、物理血缘（FK/视图） | 采集任务按"层 × 数据源"组织，逐层入库 |
| 关系声明 | 登记"某层的对象由另一层某对象导入（加工）而来"的逻辑数据流 | 跨源建立 TABLE / COLUMN 级血缘边，可追溯、可视化 |

物理数据搬运（调度 ETL 作业搬数据）不在本平台范围内；平台通过 OpenLineage 事件可接收外部调度器（Airflow/Spark）上报的**运行时血缘**，与静态声明互补。

## 2. 现状能力与缺口

### 已有能力（可复用）

| 能力 | 现状 |
| :--- | :--- |
| 数据源管理 | `data_sources` 表：host/port/database 独立连接（M11 模块）|
| 分层采集 | 每个采集任务绑定 1 个数据源 + `target_schemas`；`LayerResolver` 按对象名前缀（ods_/dwd_/dws_/ads_/app_）自动分层 |
| 单源血缘发现 | FK（JDBC_FK）、视图依赖（VIEW_DEP）、视图列级解析（PARSER），均在**单连接内**完成 |
| 跨源建边通道 | `POST /lineage/edges` 手工建边已存在；OpenLineage 摄入天然跨源（数据集名解析） |
| 边安全清理 | `deleteAutoDiscoveredBySchemas` 按 source 白名单（JDBC_FK/VIEW_DEP/PARSER）重建，不误删手工/契约边 |

### 核心缺口

1. **资产的来源归属缺失**：`assetId = "asset:{schema}.{table}"` 无数据源维度，`assets` 表也无 `data_source_id`——跨源分布后无法回答"这张表在哪个源"。
2. **无跨源关系编排**：血缘发现只发生在采集连接内部，两层位于不同源时无法自动建边。
3. **无层间关系登记模型**：没有"ODS 层（源 A）→ DWD 层（源 B）"的声明载体。

## 3. 总体方案

```
┌────────────────────────────────────────────────────────────────┐
│  数据源层（各自独立连接）                                        │
│  源① CRM 库(ODS)   源② 明细仓(DWD)   源③ 汇总仓(DWS)            │
│  源④ 分析仓(ADS)   源⑤ 应用库(APP)                              │
└─────────┬──────────────┬───────────────┬───────────────────────┘
          │ 逐层采集（每层一个采集任务，回填资产归属）
          ▼
┌────────────────────────────────────────────────────────────────┐
│  资产库（assets + data_source_id 归属 + layer 标签）             │
└─────────┬──────────────────────────────────────────────────────┘
          │ 层间关系构建（三条通道）
          ▼
┌────────────────────────────────────────────────────────────────┐
│  通道 A 关系登记自动匹配  通道 B ETL SQL 解析  通道 C 手工连线    │
│  (CROSS_SOURCE, 70)      (ETL_PARSER, 90/85)  (MANUAL, 100)    │
└─────────┬──────────────────────────────────────────────────────┘
          ▼
┌────────────────────────────────────────────────────────────────┐
│  血缘图（M2 跨源标识 + 层间链路视图 + M1 资产来源徽标）           │
└────────────────────────────────────────────────────────────────┘
```

### 3.1 采集侧：层 × 数据源独立导入

**复用现有任务模型，不新建"采集工程"概念**（最小改动原则）：

- 每一层配置一条采集任务：`任务 = (data_source_id, target_schemas, default_layer)`，如
  - 任务 1：源① + schema `layer_ods` + 层 ODS
  - 任务 2：源② + schema `layer_dwd` + 层 DWD
  - ……
- `LayerResolver` 已支持按对象名前缀二次路由，一个源承载多层时无需拆分任务。
- 新增 `target_layers` 过滤（可选）：任务只注册指定层的对象（多源演示用不到，留给单源多层场景）。

**采集器改造（2 处）**：
1. `JdbcSchemaCollector.registerAsset` 回填 `data_source_id = task.getDataSourceId()`。
2. `collectSchema` 分层过滤：`targetLayers` 非空时仅注册命中层的对象（默认空 = 全量，向后兼容）。

### 3.2 关系侧：新增"层间导入关系"（Layer Import Relation）

**数据模型（V7 迁移）**：

```sql
-- 1) 资产归属数据源
ALTER TABLE assets ADD COLUMN data_source_id VARCHAR(64) NULL COMMENT '归属数据源' AFTER space;
ALTER TABLE assets ADD INDEX idx_data_source (data_source_id);

-- 2) 层间导入关系表
CREATE TABLE IF NOT EXISTS layer_import_relations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL COMMENT '关系名称，如 ODS源库->DWD明细仓',
    from_layer ENUM('ODS','DWD','DWS','ADS','APP') NOT NULL,
    to_layer ENUM('ODS','DWD','DWS','ADS','APP') NOT NULL,
    from_data_source_id VARCHAR(64) NOT NULL,
    to_data_source_id VARCHAR(64) NOT NULL,
    match_mode ENUM('OBJECT_NAME','ETL_SQL') NOT NULL DEFAULT 'OBJECT_NAME',
    etl_sql TEXT NULL COMMENT 'ETL_SQL 模式：INSERT INTO ... SELECT ... 语句（可多条，; 分隔）',
    status ENUM('ACTIVE','PAUSED') DEFAULT 'ACTIVE',
    last_build_at DATETIME,
    last_build_result VARCHAR(256) COMMENT '构建结果摘要',
    edges_built INT DEFAULT 0 COMMENT '最近一次构建产出的边数',
    created_by VARCHAR(128),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_from (from_data_source_id, from_layer),
    INDEX idx_to (to_data_source_id, to_layer)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='层间导入关系表';

-- 3) 边来源扩展（沿用 V3 的 ALTER MODIFY 先例）
ALTER TABLE lineage_edges MODIFY COLUMN source
    ENUM('CONTRACT','OPENLINEAGE','PARSER','PROBE','JDBC_FK','VIEW_DEP','CROSS_SOURCE','ETL_PARSER')
    NOT NULL;
```

**三条建边通道**：

| 通道 | source | 置信度 | 机制 |
| :--- | :--- | :--- | :--- |
| A. 关系登记自动匹配 | `CROSS_SOURCE` | 70 | 去除层前缀后业务对象名唯一匹配：`ods_order` → `dwd_order` |
| B. ETL SQL 解析 | `ETL_PARSER` | 90/85 | 解析 `INSERT INTO dwd.x SELECT ... FROM ods.y`，产出 TABLE 边 + 列级映射边 |
| C. 手工连线 | `MANUAL` | 100 | 复用已有 `POST /lineage/edges`，前端 M2 强化交互 |

**通道 A 匹配算法**（`stripLayerPrefix` 去 ods_/dwd_/dws_/ads_/app_ 前缀）：

1. 取 from 数据源 × from 层的全部资产，建立 `业务名 → 资产` 索引；
2. 取 to 数据源 × to 层的资产逐个查索引；
3. 唯一命中 → 建 TABLE 边（`transform_expr = "relation:{relationId}"` 标识来源）；歧义（同业务名多表）或未命中 → 跳过并计入构建报告；
4. 幂等重建：构建前先删 `source IN ('CROSS_SOURCE','ETL_PARSER') AND transform_expr = 'relation:{id}'` 的旧边。

**通道 B 解析器**（新类 `EtlSqlLineageParser`，复用 druid 1.2.20）：

- 解析 `INSERT INTO <schema.table> [(cols)] SELECT <exprs> FROM <src> [JOIN ...] [WHERE ...]`；
- 输出：所有源表 → 目标表的 TABLE 边；SELECT 列表为简单列/限定列时按位置/名称映射出 COLUMN 边；
- 表达式（聚合/函数）降级仅 TABLE 边；多语句以 `;` 分隔逐条解析；
- 每条边同样打 `transform_expr = "relation:{id}"` 用于幂等重建。

### 3.3 API 设计

```
POST   /layer-imports                创建关系（校验：层对合法、源存在、ETL_SQL 模式必填语句）
GET    /layer-imports                列表（可选 fromLayer/toLayer/status 过滤，附层资产计数）
DELETE /layer-imports/{id}           删除关系（级联删除其产出的边）
POST   /layer-imports/{id}/preview   试运行：返回将建立的边清单 + 未匹配/歧义清单（不落库）
POST   /layer-imports/{id}/build     执行建边（幂等重建，返回 {edgesBuilt, matched, skipped, ambiguous}）
GET    /layer-imports/stats          层间关系统计（各层资产数×数据源 + 关系数 + 边数，供前端矩阵图）
```

### 3.4 前端设计

**M10 采集与管理 → 新增「分层导入」标签页**（主战场）：

1. **层-源矩阵**：行 = 5 层，列 = 数据源下拉 + 该层资产计数（实时显示"ODS = CRM源 · 12 个对象"）；
2. **关系卡片列表**：`ODS源 → DWD明细仓 · 同名匹配 · 12 条边 · [预览] [重建] [删除]`；
3. **新建关系向导**：选 from 层/源 → 选 to 层/源 → 选模式 → （ETL_SQL 模式：语句编辑框）→ 预览边清单 → 保存并构建。

**M2 血缘探索器**：

- 跨源边视觉标识：from/to 资产 `data_source_id` 不同时，边渲染为虚线 + 跨源徽标，边详情显示"跨源：CRM源 → DWD明细仓"；
- 层间链路模式：按层分泳道（五层已有图层着色），跨源边突出显示。

**M1 资产目录**：资产卡显示归属数据源徽标（如 `CRM源`），支持按数据源过滤。

### 3.5 演示数据方案（multisource 模式）

在现有 `switch-demo.sh` 增加第三模式 `multisource`（`baseline`/`full` 保持不动）：

- **5 个业务库模拟五层多源**（同容器、不同 database，各注册为独立数据源）：
  `layer_ods`（ods_*）· `layer_dwd`（dwd_*）· `layer_dws`（dws_*）· `layer_ads`（ads_*）· `layer_app`（app_*）
- **5 条数据源 + 5 条采集任务**（各扫本库，default_layer 对应）
- **4 条层间关系**：ODS源 → DWD / DWS / ADS / APP，其中 2 条同名匹配、2 条 ETL SQL（演示列级边）
- 演示效果：M2 从 `ods_orders` 出发，可见跨 5 个源的完整链路；M10 分层导入页可见 4 条关系的构建状态。

### 3.6 实施批次与验收

| 批次 | 内容 | 验收标准 |
| :--- | :--- | :--- |
| P0 | V7 迁移；采集器回填 `data_source_id`；`LayerImportService` + API（通道 A）；单测 | 同名匹配建边正确、幂等重建；preview 不落库 |
| P1 | `EtlSqlLineageParser`（通道 B）+ 列级边 | INSERT..SELECT 解析出 TABLE+COLUMN 边；多语句/JOIN 场景通过 |
| P2 | 前端：M10 分层导入页、M2 跨源标识、M1 归属徽标 | tsc 0 错误；模块探针存活；交互闭环可点 |
| P3 | `multisource` 演示数据 + switch-demo.sh 扩展 + README + 端到端验证 | 三模式切换幂等；E2E 截图存档；双远程提交 |

### 3.7 风险与对策

| 风险 | 对策 |
| :--- | :--- |
| `assetId` 无数据源维度，跨源同名 `schema.table` 冲突 | 约定各源 schema 命名空间不同（演示与多数企业场景天然满足）；P2 加"同名资产多源归属"检测告警（不阻塞） |
| 同名匹配误报（业务名相同但无实际加工关系） | 置信度 70 低于精确通道；preview 人工确认后才构建；关系可随时删除并级联清边 |
| ENUM 扩展的迁移兼容 | 沿用 V3 `ALTER MODIFY` 先例，MySQL ENUM 追加热值安全 |
| 跨源边被采集重建误删 | 新 source 类型不在 `deleteAutoDiscoveredBySchemas` 白名单内；关系删除时按 `transform_expr` 级联清理 |
| 单源多任务重复采集同表 | 冲突检测（P2）识别同 assetId 多源归属；采集本身 update 幂等不重复建资产 |

## 4. 关键决策记录

1. **不新建"采集工程"聚合概念**：现有"一任务一数据源 + 层前缀路由"已覆盖多源分层；复杂度留给关系编排层。
2. **层间关系是显式声明**：不做"全库猜测式跨源匹配"，匹配范围严格限定在声明的 (from 源×层 → to 源×层) 内，控制误报面。
3. **边来源可追溯**：所有跨源边携带 `transform_expr = relation:{id}`，支持按关系删除/重建，与手工边、契约边隔离。
