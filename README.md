# DataLineage Studio — 通用数据血缘与变更治理平台

以血缘图谱为核心、变更事件为驱动、契约与校验为质量底线的企业级通用数据资产管理应用。前端 13 个模块（M1–M13）+ Spring Boot 后端 + MySQL，内置双时态血缘、全链路审计、变更 Webhook、数据标准落标与高可用部署。

## 快速开始（本地开发）

**前置条件**：Docker、JDK 17、Maven、Node.js 20+

```bash
# 1) MySQL（容器，宿主端口 3307；Flyway 启动时自动建表并应用 V1–V17 迁移）
docker run -d --name dl-mysql-test -p 3307:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 -e MYSQL_DATABASE=datalineage mysql:8.0

# 2) 后端（http://localhost:8080，context-path /api/v1）
cd backend && mvn package -DskipTests
SPRING_DATASOURCE_URL='jdbc:mysql://localhost:3307/datalineage?useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true' \
  java -jar target/datalineage-backend-1.0.0.jar

# 3) 前端（验证脚本默认面向 :5173）
npm install --legacy-peer-deps
npx vite --port 5173        # 或 npm run dev（:3000）
```

默认账号 `admin / admin123`（另有 `viewer / viewer123` 只读角色）。

**环境变量**：`JWT_SECRET`（多实例必须共享，生产必改）、`ENCRYPT_KEY`（数据源密码 Jasypt 加密）、`SPRING_DATASOURCE_URL/USERNAME/PASSWORD`。

## 演示数据切换 (Demo Data Switch)

内置三套演示数据，通过 `scripts/switch-demo.sh` 一键切换（幂等，可反复执行）：

| 模式 | 内容 |
| :--- | :--- |
| `baseline` | 干净基线：业务库 20 对象 + 五层血缘，治理侧数据清零，平均健康分 75.5 |
| `full` | 完整功能数据：21 资产（含 legacy 违规对象，触发采集后命名校验闭环）· 8 标准 · 12 词根 · 17 参考编码 · 6 契约 · 8 指标 · 10 校验规则 · 质量问题 · 待审批变更 · 通知 |
| `multisource` | 多数据源分层导入：28 资产分属 3 个数据源（`本地测试MySQL`=ODS · `数仓层MySQL（DWD+DWS）` · `应用层MySQL（ADS+APP）`），4 条层间导入关系（同名匹配 ×2 + ETL SQL 解析 ×2）构建 18 条跨源血缘边（8 表级 + 10 列级，含 SUM/DATE/MAX 转换表达式） |

```bash
./scripts/switch-demo.sh status        # 查看当前数据模式与关键计数
./scripts/switch-demo.sh full          # 切换为完整功能演示数据
./scripts/switch-demo.sh multisource   # 切换为多数据源分层导入演示
./scripts/switch-demo.sh baseline      # 恢复干净基线
```

**前置条件**：MySQL 容器 `dl-mysql-test` 运行中（localhost:3307）、后端运行中（localhost:8080）。

**切换链路**：`full` = 重建业务库 → 创建 legacy 遗留表 → 触发采集 → 装载治理数据 → 执行命名校验闭环；`multisource` = 治理侧归零 → 重建 dw_warehouse/dw_app 两库 → 三数据源采集 → 创建层间关系 → 构建跨源血缘；`baseline` = 逆向清理治理数据与多源演示数据并重建业务库。三套数据任意顺序双向切换均已验证幂等。

**multisource 演示路径**：M10 采集与管理 → 「分层导入（跨数据源）」页签可查看分层×数据源矩阵与 4 条关系，对关系执行「预检」（dry-run）或「构建」（幂等重建）；M1 资产目录可见数据源归属徽标；M2 血缘探索器切换到「力导向拓扑」或「放射同心圆」布局后，图中青绿色（teal）连线即为跨源导入血缘（分层泳道视图按设计不渲染连线）。

**数据来源**：`scripts/demo-dataset.sql`（业务库五层基线）、`scripts/demo-full-data.sql`（治理侧功能数据）、`scripts/demo-multisource.sql`（数仓层/应用层两库 8 表）。

## 能力总览（企业级收尾批次 1–6）

| 能力 | 说明 |
| :--- | :--- |
| 血缘双时态闭环 | 采集端软失效/复活；查询端统一 `valid_to IS NULL` 过滤；每日 02:00 滞留清理（90 天未复现自动失效 + 置信度衰减）；`GET /lineage/edges/at-time` 时点回放（Header「时点回放」+ 日期选择） |
| 采集可靠性 | 失败自动重试（最多 3 次，退避 2s/8s），`runLog.detail.attempts` 结构化记录；前端轮询进度 |
| 数据标准 | 命名标准自动落标（采集成功后自动执行，或手动 `POST /standards/naming-check`，违规生成 STANDARD 质量问题）；契约 vs schema 对照校验（`POST /contracts/{id}/validate-schema`） |
| 全链路审计 | AOP 自动覆盖全部写端点：用户/角色/动作/资源/结果/耗时/客户端 IP；`GET /audit-logs` 多条件分页；M9 审计轨迹抽屉 |
| 变更 Webhook | change.created / approval.decided / standard.violation 事件异步投递；HMAC-SHA256 签名；M8 配置弹窗（CRUD + 测试发送） |
| 前端健壮性 | 全局 + 模块级 ErrorBoundary（单模块崩溃不白屏）；首同步骨架屏 |
| M13 模型增强 | 支持 ERMaster `.erm` 与 PowerDesigner `.pdm`；同名重导自动升版（v1/v2…）；版本回放与对比；差异导出 markdown/csv |
| 模型维护 | 已导入模型可重命名 / 改目标分层、状态、对比数据源 / 整体删除（`PUT /models/{id}` · `DELETE /models/{id}`，连带表结构快照与版本历史，同级名称冲突拦截，写操作自动审计） |
| 高可用部署 | 双后端实例 + nginx 网关（故障转移），共享 JWT 无状态；多架构镜像（amd64/arm64） |

## Docker 部署

**单点**（前端 nginx 网关 :3000 · 后端 :8080 · MySQL :3306）：

```bash
docker-compose up -d --build
# 打开 http://localhost:3000
```

**高可用**（`docker-compose.ha.yml`）：

```
浏览器 ──> frontend (nginx :8088)
             │  /api/* 轮询 + 故障转移 (proxy_next_upstream)
             ├──> backend-1 :8080 ─┐  同一镜像 datalineage-backend:ha
             └──> backend-2 :8080 ─┘  共享 JWT_SECRET（无状态）
                       └──────────> MySQL :3308（单点，范围外）
```

```bash
docker-compose -f docker-compose.ha.yml up -d --build

# 实起验证：双实例 health UP、网关 200、停任一实例仍 200（同 token 跨实例有效）
bash scripts/b6-ha-verify.sh          # 结果 → screenshots/b6-ha-report.txt
node scripts/b6-ha-browser.mjs        # 浏览器端到端（经网关 8 条 API 全 2xx）
docker stop datalineage-backend-ha-2  # 手动演示故障转移，请求仍由 backend-1 服务
```

网关 upstream 由 `BACKEND_SERVERS` 环境变量渲染（默认双实例；单点 compose 覆写为 `server backend:8080;`）。

## 审计日志与变更 Webhook

- 审计：凡 Controller 的写操作（POST/PUT/DELETE）自动落 `audit_logs`，查询
  `GET /audit-logs?username=&action=&resourceType=&result=&from=&to=&page=&size=`
- Webhook 配置：`GET/POST/PUT/DELETE /webhooks`、`POST /webhooks/{id}/test`
- 投递头：`X-DL-Event`（事件名）、`X-DL-Timestamp`（毫秒）、`X-DL-Signature: sha256=HMAC-SHA256(timestamp + "." + body, secret)`（secret 为空则不签名）
- 投递度量：`datalineage_webhook_deliveries_total{result="success|failed"}`

## 关键 API 速查（批次 1–5 新增）

| 能力 | 端点 |
| :--- | :--- |
| 时点回放 | `GET /lineage/edges/at-time?time=yyyy-MM-dd HH:mm:ss` |
| 滞留清理（手动） | `POST /lineage/retention/sweep` |
| 契约对照校验 | `POST /contracts/{id}/validate-schema` |
| 标准自动落标 | `POST /standards/naming-check`（采集成功后亦自动执行） |
| 模型版本链 | `GET /models/{id}/versions` · `GET /model-versions/{vid}/tables` |
| 版本对比 | `GET /models/{id}/versions/diff?from=&to=`（`from=0` → 空基线） |
| 差异导出 | `GET /models/{id}/compare/export?format=markdown|csv` |
| 审计查询 | `GET /audit-logs` |
| Webhook 管理 | `GET/POST/PUT/DELETE /webhooks` · `POST /webhooks/{id}/test` |

## 验证脚本

```bash
node scripts/bitemporal-verify.mjs      # 双时态+采集重试（依赖 mysql 容器 dl-mysql-test）
node scripts/audit-webhook-verify.mjs   # 审计+Webhook（本地接收端 + HMAC 断言）
node scripts/m13-verify.mjs             # 模型导入/版本/对比/导出（fixtures/pdm-sample*.pdm）
node scripts/auth-verify.mjs            # JWT+RBAC（25 项）
node scripts/m10-verify.mjs             # 采集管理 UI（浏览器，需 vite :5173）
node scripts/metrics-verify.mjs         # Prometheus 指标（16 项）
node scripts/governance-smoke.mjs       # 治理场景冒烟（浏览器）
```

## 监控

- 健康：`GET /api/v1/actuator/health`
- 指标：`GET /api/v1/actuator/prometheus`（关键：`datalineage_lineage_edges_total`、`datalineage_lineage_edges_expired_total`、`datalineage_webhook_deliveries_total`、`datalineage_collector_runs_total`、`datalineage_validation_open_issues`）
