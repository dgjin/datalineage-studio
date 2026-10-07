import React from 'react';
import { 
  Home, 
  Database, 
  GitFork, 
  AlertOctagon, 
  Activity, 
  Binary, 
  FileCheck2, 
  ShieldAlert, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Flame,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Asset, ChangeEvent, QualityIssue, MetricDefinition } from '../../types/lineage';

interface WorkbenchProps {
  assets: Asset[];
  changes: ChangeEvent[];
  issues: QualityIssue[];
  metrics: MetricDefinition[];
  onNavigateTab: (tab: any) => void;
  onSelectAsset: (assetId: string) => void;
  onSimulateChange: (assetId: string) => void;
}

export const Workbench: React.FC<WorkbenchProps> = ({
  assets,
  changes,
  issues,
  metrics,
  onNavigateTab,
  onSelectAsset,
  onSimulateChange
}) => {
  const pendingAckChanges = changes.filter(c => c.status === 'ACK_PENDING');
  const darkChanges = changes.filter(c => !c.isManaged);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6 space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/30 p-6 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>通用数据血缘与变更治理平台 (Universal Data Mesh Lineage)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            以血缘图谱为核心、以变更事件为驱动、以契约与校验为底线
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            实时闭环回答：<strong>这个数从哪来？改它会怎样？现在对不对？谁该知道？</strong> 杜绝反向手改，落实代码化合规契约。
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onNavigateTab('lineage')}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 flex items-center gap-1.5 transition"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>全域血缘探索器 (M2)</span>
            </button>
            <button
              onClick={() => onNavigateTab('impact')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition"
            >
              <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
              <span>What-If 影响模拟 (M3)</span>
            </button>
            <button
              onClick={() => onNavigateTab('metrics')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Binary className="w-3.5 h-3.5 text-cyan-400" />
              <span>{metrics.length} 项核心指标库 (M5)</span>
            </button>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-indigo-500/10 via-indigo-400/5 to-transparent pointer-events-none" />
      </div>

      {/* Operational Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Pending Ack Tasks */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>待我确认的变更 (Pending Ack)</span>
            </span>
            <span className="font-mono text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/20">
              {pendingAckChanges.length} 项
            </span>
          </div>

          <div className="space-y-2">
            {pendingAckChanges.slice(0, 2).map(c => (
              <div
                key={c.id}
                onClick={() => onNavigateTab('changes')}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-indigo-500/40 transition space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-white">{c.assetName}</span>
                  <span className="text-[10px] text-amber-400 font-bold">{c.changeType}</span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">{c.impactSummary}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => onNavigateTab('changes')}
            className="w-full text-center text-[11px] text-indigo-400 hover:text-indigo-300 pt-1"
          >
            前往变更中心确认 →
          </button>
        </div>

        {/* Dark-Change Remediation alerts */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <span>未纳管暗改巡检 (Unmanaged)</span>
            </span>
            <span className="font-mono text-rose-400 font-bold px-2 py-0.5 rounded bg-rose-500/20">
              {darkChanges.length} 项高危
            </span>
          </div>

          <div className="space-y-2">
            {darkChanges.map(c => (
              <div
                key={c.id}
                onClick={() => onNavigateTab('changes')}
                className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30 cursor-pointer hover:border-rose-500/60 transition space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-rose-200">{c.assetName}</span>
                  <span className="text-[10px] text-rose-400">绕过契约直接DDL</span>
                </div>
                <p className="text-[11px] text-slate-300">探针定时巡检发现生产孤儿对象，建议一键反向生成契约补丁</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => onNavigateTab('changes')}
            className="w-full text-center text-[11px] text-rose-400 hover:text-rose-300 pt-1"
          >
            立即执行契约反向补录 →
          </button>
        </div>

        {/* Quality Issues Digest */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              <span>数据质量问题闭环</span>
            </span>
            <span className="font-mono text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-500/20">
              {issues.length} 待办
            </span>
          </div>

          <div className="space-y-2">
            {issues.slice(0, 2).map(iss => (
              <div
                key={iss.id}
                onClick={() => onNavigateTab('validation')}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-cyan-500/40 transition space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-white">{iss.code}</span>
                  <span className="text-[10px] text-slate-400">截止: {iss.dueDate}</span>
                </div>
                <p className="text-[11px] text-slate-300 line-clamp-1">{iss.title}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => onNavigateTab('validation')}
            className="w-full text-center text-[11px] text-cyan-400 hover:text-cyan-300 pt-1"
          >
            查看完整问题台账 →
          </button>
        </div>
      </div>

      {/* Featured Core Assets Table */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <span>重点监控与核心数据资产 (Top Monitored Entities)</span>
          </h3>
          <button
            onClick={() => onNavigateTab('catalog')}
            className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1"
          >
            <span>进入 M1 查看全部</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {assets.slice(0, 3).map(asset => (
            <div
              key={asset.id}
              onClick={() => onSelectAsset(asset.id)}
              className="p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-slate-600 transition cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {asset.layer}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                  置信度 {asset.confidence}%
                </span>
              </div>
              <div>
                <div className="font-mono font-bold text-white text-sm">{asset.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{asset.displayTitle}</div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800/80">
                <span>Owner: {asset.owner.split(' ')[0]}</span>
                <span className="text-indigo-400 font-semibold">{asset.downstreamCount} 个下游消费</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
