<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/74982ea4-54d8-4264-a989-894814c035ac

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## 演示数据切换 (Demo Data Switch)

内置两套演示数据，通过 `scripts/switch-demo.sh` 一键切换（幂等，可反复执行）：

| 模式 | 内容 |
| :--- | :--- |
| `baseline` | 干净基线：业务库 20 对象 + 五层血缘，治理侧数据清零，平均健康分 75.5 |
| `full` | 完整功能数据：21 资产（含 legacy 违规对象，触发采集后命名校验闭环）· 8 标准 · 12 词根 · 17 参考编码 · 6 契约 · 8 指标 · 10 校验规则 · 质量问题 · 待审批变更 · 通知 |

```bash
./scripts/switch-demo.sh status    # 查看当前数据模式与关键计数
./scripts/switch-demo.sh full      # 切换为完整功能演示数据
./scripts/switch-demo.sh baseline  # 恢复干净基线
```

**前置条件**：MySQL 容器 `dl-mysql-test` 运行中（localhost:3307）、后端运行中（localhost:8080）。

**切换链路**：`full` = 重建业务库 → 创建 legacy 遗留表 → 触发采集 → 装载治理数据 → 执行命名校验闭环；`baseline` = 逆向清理治理数据并重建。两套数据双向切换均已验证幂等。

**数据来源**：`scripts/demo-dataset.sql`（业务库五层基线）、`scripts/demo-full-data.sql`（治理侧功能数据）。
