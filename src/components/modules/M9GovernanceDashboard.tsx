import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  Download, 
  Copy, 
  Check, 
  Layers, 
  Activity, 
  Sparkles,
  Users
} from 'lucide-react';

export const M9GovernanceDashboard: React.FC = () => {
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const sampleWeeklyReport = `# 数据血缘与资产治理工作周报 (2026年第39周)
生成时间: 2026-09-30 ｜ 汇报部门: 数据治理组与架构委员会

## 一、核心治理健康度量
- 全域资产覆盖率: 98.4% (已纳管 482 项，孤儿资产 1 项)
- 字段级精细血缘覆盖率: 87.2%
- 规则校验通过率: 96.5% (VR-001~015 执行 2,410 次)
- 本周捕获未纳管暗改 (Unmanaged Schema Drift): 1 项 (已转入反向补录流程)

## 二、变更与 CI 卡点审计
- 本周变更事件总量: 34 项
- 破坏性变更 (Breaking Changes): 3 项
- 平均影响确认响应时长 (Avg Ack Time): 4.2 小时 (同比提效 35%)
- 豁免率: 2.9% (处于健康受控红线内 < 5%)

## 三、下周重点治理任务
1. 推动 CRM 域 ods_crm_customer.phone 彻底下线与下游双写切换
2. 清理生产临时暗改表 crm_temp_test_dump 物理下线
3. 扩展指标中心 178 项资产至人行与 AMC EAST 监管三套口径自动映射
`;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <span>M9 治理运营看板与工作汇报驾驶舱</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            提供可量化、可审计、支撑领导汇报的四大治理指标板块，支持一键生成规范周报
          </p>
        </div>

        <button
          onClick={() => setReportModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs transition shadow-lg shadow-indigo-500/20 flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          <span>一键导出治理工作周报 (Markdown)</span>
        </button>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Card 1: Lineage Coverage */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">全域血缘覆盖率</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">98.4%</div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            <span>字段级血缘: <strong className="text-emerald-400">87.2%</strong></span>
            <span className="text-emerald-400">↑ 2.1% 环比</span>
          </div>
        </div>

        {/* Card 2: Breaking Change Ratio */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">破坏性变更占比</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">8.8%</div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            <span>CI 卡点阻断率: <strong className="text-white">100%</strong></span>
            <span className="text-emerald-400">↓ 1.4% 环比</span>
          </div>
        </div>

        {/* Card 3: Quality Rule Pass Rate */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">规则校验通过率</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">96.5%</div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            <span>VR-001~015 执行 2,410 次</span>
            <span className="text-emerald-400 font-mono">P0 无断链</span>
          </div>
        </div>

        {/* Card 4: Avg Ack Response Time */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Owner 平均确认时长</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">4.2 小时</div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            <span>豁免率: <strong className="text-purple-400">2.9%</strong> (红线&lt;5%)</span>
            <span className="text-emerald-400">提效 35%</span>
          </div>
        </div>
      </div>

      {/* Detailed Analytics Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Layer Coverage Breakdown */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs">
          <h3 className="font-bold text-white uppercase tracking-wider">
            数仓分层血缘纳管明细 (Layer Breakdown)
          </h3>
          <div className="space-y-2.5">
            {[
              { layer: 'ODS (源数据层)', count: 126, managed: '100%', colCoverage: '92%' },
              { layer: 'DWD (规范明细层)', count: 98, managed: '100%', colCoverage: '95%' },
              { layer: 'DWS (轻度汇总层)', count: 64, managed: '100%', colCoverage: '89%' },
              { layer: 'ADS (应用集市层)', count: 42, managed: '98%', colCoverage: '84%' },
              { layer: 'APP (报表/API/指标)', count: 152, managed: '96%', colCoverage: '78%' }
            ].map((row, i) => (
              <div key={i} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200 block">{row.layer}</span>
                  <span className="text-[10px] text-slate-400">{row.count} 个实体对象</span>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 block">纳管率</span>
                    <span className="font-mono font-bold text-emerald-400">{row.managed}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">字段级血缘</span>
                    <span className="font-mono font-bold text-cyan-400">{row.colCoverage}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Change Health & Risk Radar */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs">
          <h3 className="font-bold text-white uppercase tracking-wider">
            变更闭环与暗改防范治理基线
          </h3>
          <div className="space-y-3">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">暗改阻断合规率</span>
                <span className="font-mono font-bold text-emerald-400">97.1%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="w-[97%] h-full bg-emerald-500 rounded-full" />
              </div>
              <span className="text-[10px] text-slate-400 block pt-0.5">
                探针与 CDC 发现的未纳管改动均能在 24 小时内完成反向契约补录
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">核心指标三级溯源穿透率</span>
                <span className="font-mono font-bold text-cyan-400">100%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="w-full h-full bg-cyan-500 rounded-full" />
              </div>
              <span className="text-[10px] text-slate-400 block pt-0.5">
                首批 178 项核心业务指标已全部完成口径卡到物理存储列映射
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">破坏性变更确认完成率 (Ack Close Rate)</span>
                <span className="font-mono font-bold text-indigo-400">94.3%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="w-[94%] h-full bg-indigo-500 rounded-full" />
              </div>
              <span className="text-[10px] text-slate-400 block pt-0.5">
                全部受影响下游 Owner 均在发布窗口前完成合规签署
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm">治理工作周报预览 (Markdown 导出)</h3>
                <p className="text-slate-400 text-[11px] mt-0.5">可直接复制发往数据治理委员会、周例会与管理层汇报</p>
              </div>
              <button onClick={() => setReportModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <pre className="p-3.5 bg-slate-950 rounded-lg text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800 max-h-80 leading-relaxed">
              {sampleWeeklyReport}
            </pre>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(sampleWeeklyReport);
                  setCopiedReport(true);
                  setTimeout(() => setCopiedReport(false), 2000);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5"
              >
                {copiedReport ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedReport ? '已复制 Markdown' : '复制周报文本'}</span>
              </button>
              <button
                onClick={() => setReportModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
