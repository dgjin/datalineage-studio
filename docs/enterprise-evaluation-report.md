# DataLineage Studio 企业级数据治理平台评估报告

> 评估日期：2026-10-06 | 评估范围：全链路（采集 → 血缘 → 治理 → 消费）| 评估标准：企业级数据治理平台成熟度模型

---

## 一、总体评估结论

| 维度 | 评分 | 等级 | 核心结论 |
|------|------|------|----------|
| **元数据采集** | 85/100 | 良好 | JDBC 采集引擎完整，支持多数据源、增量对比、调度执行 |
| **血缘引擎** | 78/100 | 良好 | 表级+列级血缘完整，跨源导入三通道设计合理，但存在数据一致性问题 |
| **治理闭环** | 72/100 | 中等 | 变更/审批/标准/校验状态机完整，但多个模块仍依赖 mock 数据 |
| **前端链路** | 68/100 | 中等 | 核心模块（M1/M2/M4/M9/M11/M12/M13）已接真实 API，但 M3/M5/M6/M7/M8 仍为 mock |
| **数据一致性** | 55/100 | 待改进 | 资产上下游计数全为 0、僵尸资产误判、健康分计算依赖不准数据 |
| **架构设计** | 82/100 | 良好 | 分层清晰、扩展性好、幂等设计到位，但缺少异步处理和缓存层 |

**综合评分：73/100 — 具备企业级平台骨架，需补齐数据一致性与模块真实化两大短板**

---

## 二、各环节详细评估

### 2.1 元数据采集链路（M10/M11）

**架构设计：优秀**
- `JdbcSchemaCollector` 614 行实现完整：表发现 → 字段采集 → 主键识别 → PII 启发式标记 → 血缘发现（FK/VIEW_DEP/PARSER）
- `CollectorService` 调度管理完善：cron 动态调度、手动触发、运行日志、暂停/恢复
- 多数据源隔离：`TABLE_CAT/TABLE_SCHEM` 过滤防跨库污染，asset code 加 hash 后缀防冲突

**数据质量：良好**
- 当前采集 28 资产（14 表 + 14 视图）、133 字段、119 条血缘边
- 0 孤儿边、0 孤立资产、0 缺失层、0 缺失数据源归属
- 11 个资产含 PII 字段标记

**问题与建议：**

| 严重度 | 问题 | 影响 | 建议 |
|--------|------|------|------|
| P1 | 采集为同步阻塞执行 | 大库采集时前端长时间等待，无进度反馈 | 改为异步执行 + WebSocket/SSE 推送进度 |
| P2 | 无采集失败重试机制 | 网络抖动导致采集失败需手动重跑 | 增加指数退避重试（最多 3 次） |
| P2 | 采集日志仅保留文本摘要 | 无法追溯具体变更了哪些字段 | 结构化存储变更明细（JSON） |

---

### 2.2 血缘引擎（M2）

**架构设计：优秀**
- 表级血缘：33 条 TABLE 边，覆盖 ODS→DWD→DWS→ADS→APP 全链路
- 列级血缘：86 条 COLUMN 边（90 条含列信息），支持表达式映射（SUM/DATE/MAX）
- 跨源导入三通道：OBJECT_NAME（同名匹配 c=70）、ETL_SQL（Druid AST 解析 c=85~95）、CROSS_SOURCE（手动）
- 边来源白名单设计：JDBC_FK/VIEW_DEP/PARSER 进入采集清理，CROSS_SOURCE/ETL_PARSER 保留防误删

**数据质量：存在关键缺陷**

| 严重度 | 问题 | 影响 | 建议 |
|--------|------|------|------|
| **P0** | **downstream_count/upstream_count 全为 0** | 资产健康分误判 ADS/APP 为"僵尸资产"；M1 资产卡片显示 0 下游；影响分析无法预排序 | 采集完成后批量更新计数，或改为实时计算（SQL COUNT） |
| P1 | 无血缘边置信度衰减机制 | 历史边可能已失效但仍参与影响分析 | 增加 `valid_to` 时间戳 + 定期置信度衰减 |
| P2 | 列级血缘缺少表达式解析深度 | 复杂 CASE WHEN/子查询可能遗漏 | 已部分解决（双 visitor），建议增加 SQL 覆盖测试用例 |

**修复方案（P0）：**
```java
// 在 JdbcSchemaCollector.collect() 完成后调用
private void updateAssetCounts() {
    assetMapper.update(null, new UpdateWrapper<AssetEntity>()
        .setSql("downstream_count = (SELECT COUNT(*) FROM lineage_edges WHERE from_asset_id = assets.id)")
        .setSql("upstream_count = (SELECT COUNT(*) FROM lineage_edges WHERE to_asset_id = assets.id)"));
}
```

---

### 2.3 治理闭环（M4/M12/M7/M9）

**状态机设计：优秀**
- 变更事件：DETECTED → ANALYZED → APPROVAL_PENDING → APPROVED/REJECTED → RESOLVED
- 审批流：自动门禁（BLOCKER/HIGH 且 managed）+ 手动提交 + 决策记录 + 通知
- 标准中枢：data_standards / glossary_terms / reference_codes 三表 + 命名校验（Pattern.matches）
- 校验规则：RULES/DRY_RUN/ISSUES 三页签 + 质量分计算

**数据现状：严重依赖 mock**

| 模块 | 真实 API | mock 残留 | 影响 |
|------|----------|-----------|------|
| M4 变更中心 | ✅ changeApi + approvalApi | 无 | 已完整 |
| M9 治理驾驶舱 | ✅ dashboardApi | 无 | 已完整 |
| M12 标准中枢 | ✅ standardApi | 无 | 已完整 |
| M7 校验中心 | ❌ 无 | rules/issues 全 mock | 无法执行真实校验 |
| M8 通知中心 | ❌ 无 | notifications 全 mock | 无法接收真实通知 |
| M5 指标中心 | ❌ 无 | metrics 全 mock | 无法管理真实指标 |
| M6 契约浏览器 | ❌ 无 | SAMPLE_CONTRACT_YAML | 无法管理真实契约 |
| M3 影响分析 | ❌ 无 | 硬编码报告 | 无法进行真实影响评估 |

**问题与建议：**

| 严重度 | 问题 | 影响 | 建议 |
|--------|------|------|------|
| **P0** | M3/M5/M6/M7/M8 五模块仍为 mock | 治理闭环断裂：变更→审批→标准→校验→通知无法端到端运行 | 按优先级逐个接入真实 API |
| P1 | 健康分计算依赖 downstream_count=0 | ADS/APP 资产全部被误判为"无下游消费"扣 15 分 | 先修复 P0 计数问题，再启用健康分 |
| P1 | 通知服务无真实触发源 | 变更/审批/校验事件无法触达用户 | 接入 NotificationService 真实创建 |
| P2 | 契约校验仅支持 YAML 语法检查 | 无法校验契约与实际 schema 的一致性 | 增加契约 vs 资产 schema 对比 |

---

### 2.4 前端链路（App.tsx + store + adapters）

**架构设计：良好**
- Zustand store 集中管理 assets/edges/changes，支持后端离线降级
- 适配器层统一处理后端扁平字段 → 前端嵌套类型（adaptAsset/adaptEdge/adaptChange）
- 15 秒节流刷新 + 页签切换触发 + 自定义事件强制刷新

**问题与建议：**

| 严重度 | 问题 | 影响 | 建议 |
|--------|------|------|------|
| P1 | M3/M5/M6/M7/M8 通过 props 接收 mock 数据 | 无法利用 store 的真实数据 | 改为从 store 或 API 直接获取 |
| P2 | 无全局错误边界 | 单个模块崩溃导致整个页面白屏 | 增加 React ErrorBoundary |
| P2 | 无加载状态骨架屏 | 数据加载时页面空白 | 增加 Skeleton 组件 |
| P3 | 15 秒节流可能过于保守 | 用户操作后数据更新延迟 | 关键操作后强制刷新（已有 lineage:refresh 事件） |

---

### 2.5 数据模型前置管理（M13）

**架构设计：优秀**
- ERMaster .erm XML 解析：StAX 流式处理、XXE 防护、容错跳过未知节点
- 独立模型库：data_models + data_model_tables 两表，不污染资产目录
- 差异对比引擎：6 种差异类型 + 名称/类型规范化
- 影响评估集成：自动调 ImpactAnalysisService.analyzeImpact

**问题与建议：**

| 严重度 | 问题 | 影响 | 建议 |
|--------|------|------|------|
| P2 | 仅支持 ERMaster 格式 | 无法导入 PowerDesigner/ERwin 等主流工具 | 增加格式适配器接口 |
| P2 | 模型版本管理缺失 | 无法对比同一模型的不同版本 | 增加 model_versions 表 |
| P3 | 差异对比结果无导出 | 无法生成差异报告供评审 | 增加 Excel/PDF 导出 |

---

## 三、关键问题汇总（按优先级）

### P0 — 阻断性问题（必须立即修复）

| # | 问题 | 影响范围 | 修复工作量 |
|---|------|----------|-----------|
| 1 | **downstream_count/upstream_count 全为 0** | M1 资产卡片、M9 健康分、M2 血缘图 | 2h |
| 2 | **M3 影响分析为硬编码 mock** | 无法进行真实影响评估 | 4h |
| 3 | **M7 校验中心为 mock** | 无法执行真实数据校验 | 6h |
| 4 | **M8 通知中心为 mock** | 无法接收真实治理通知 | 4h |

### P1 — 严重问题（本周内修复）

| # | 问题 | 影响范围 | 修复工作量 |
|---|------|----------|-----------|
| 5 | M5 指标中心为 mock | 无法管理真实指标 | 4h |
| 6 | M6 契约浏览器为 mock | 无法管理真实契约 | 4h |
| 7 | 采集同步阻塞 | 大库采集体验差 | 8h |
| 8 | 通知服务无真实触发 | 治理事件无法触达 | 4h |

### P2 — 改进建议（下周内完成）

| # | 问题 | 影响范围 | 修复工作量 |
|---|------|----------|-----------|
| 9 | 无采集失败重试 | 采集可靠性 | 2h |
| 10 | 无血缘边置信度衰减 | 影响分析准确性 | 4h |
| 11 | 契约 vs schema 一致性校验缺失 | 契约管理深度 | 6h |
| 12 | 模型格式扩展（PowerDesigner 等） | M13 适用性 | 8h |

---

## 四、企业级标准差距分析

| 企业级能力 | 当前状态 | 差距 | 建议 |
|-----------|----------|------|------|
| **元数据自动采集** | ✅ 完整 | 无异步/重试 | 增加消息队列 |
| **血缘可视化** | ✅ 完整 | 无 3D/时间轴 | 增强交互 |
| **影响分析** | ⚠️ 引擎完整但前端 mock | 前端未接入 | 接入真实 API |
| **变更管理** | ✅ 完整 | 无 CI/CD 集成 | 增加 webhook |
| **数据标准** | ✅ 完整 | 无自动落标 | 增加标准推荐 |
| **数据质量** | ⚠️ 规则引擎完整但前端 mock | 前端未接入 | 接入真实 API |
| **数据契约** | ⚠️ 存储完整但前端 mock | 前端未接入 | 接入真实 API |
| **指标管理** | ⚠️ 存储完整但前端 mock | 前端未接入 | 接入真实 API |
| **通知协同** | ⚠️ 服务完整但前端 mock | 前端未接入 | 接入真实 API |
| **数据模型管理** | ✅ 完整 | 格式单一 | 扩展格式 |
| **权限与安全** | ❌ 缺失 | 无 RBAC | 增加 Spring Security |
| **审计日志** | ⚠️ 部分（审批记录） | 无全链路审计 | 增加 AOP 审计 |
| **高可用** | ❌ 缺失 | 单点部署 | 增加集群支持 |
| **监控告警** | ❌ 缺失 | 无 metrics 暴露 | 增加 Micrometer |

---

## 五、实施路线图建议

### 第一阶段：数据一致性修复（1-2 天）

1. **修复 downstream_count/upstream_count**（2h）
   - 在 JdbcSchemaCollector.collect() 完成后批量更新
   - 或改为实时计算（推荐，避免维护成本）

2. **接入 M3 影响分析真实 API**（4h）
   - 替换硬编码报告为 impactApi.analyze()
   - 保留 What-If 模拟但接入 impactApi.simulate()

### 第二阶段：治理闭环打通（3-5 天）

3. **接入 M7 校验中心**（6h）
   - ruleApi.list() / ruleApi.execute() / ruleApi.listIssues()
   - 替换 mock rules/issues

4. **接入 M8 通知中心**（4h）
   - notificationApi.list() / notificationApi.markRead()
   - 接入 NotificationService 真实创建

5. **接入 M5 指标中心**（4h）
   - metricApi.list() / metricApi.create() / metricApi.update()
   - 替换 mock metrics

6. **接入 M6 契约浏览器**（4h）
   - contractApi.list() / contractApi.validate()
   - 替换 SAMPLE_CONTRACT_YAML

### 第三阶段：企业级增强（1-2 周）

7. **采集异步化**（8h）
   - 引入 Spring @Async + WebSocket 进度推送
   - 增加采集队列与并发控制

8. **权限与安全**（16h）
   - Spring Security + JWT
   - RBAC 角色权限（管理员/治理员/查看者）

9. **监控告警**（8h）
   - Micrometer + Prometheus 端点
   - 关键指标：采集成功率、血缘边增长率、变更处理时长

---

## 六、结论

DataLineage Studio 已具备企业级数据治理平台的**完整骨架**：采集引擎、血缘引擎、治理状态机、前端可视化均已实现且架构合理。当前最大的短板是**数据一致性**（downstream_count 全为 0）和**五个模块的 mock 残留**（M3/M5/M6/M7/M8），导致治理闭环无法端到端运行。

建议按上述路线图分三阶段推进：
- **第一阶段**（1-2 天）：修复数据一致性，打通影响分析
- **第二阶段**（3-5 天）：接入全部 mock 模块，实现治理闭环
- **第三阶段**（1-2 周）：补齐企业级能力（权限/监控/高可用）

完成第一阶段后，平台可达到**85 分**（优秀）；完成第二阶段后可达到**92 分**（企业级就绪）；完成第三阶段后可达到**95+ 分**（行业领先）。
