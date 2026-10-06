import React, { useEffect, useState } from 'react';
import { MetricDefinition } from '../../types/lineage';
import { metricApi } from '../../services/api';
import { 
  Binary, 
  Search, 
  GitFork, 
  History, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Layers, 
  FileText, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Tag
} from 'lucide-react';

interface M5MetricCenterProps {
  metrics: MetricDefinition[];
  onExploreLineage: (assetId: string) => void;
}

type HistoryEntry = NonNullable<MetricDefinition['historyDiff']>[number];

export const M5MetricCenter: React.FC<M5MetricCenterProps> = ({
  metrics,
  onExploreLineage
}) => {
  const [selectedCode, setSelectedCode] = useState<string>(metrics[0]?.code || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'MISSING_CODE' | 'MISSING_TECH' | 'COMPOSITE_DAG'>('ALL');
  const [remoteHistory, setRemoteHistory] = useState<Record<string, HistoryEntry[]>>({});

  const selectedMetric = metrics.find(m => m.code === selectedCode) || metrics[0];

  // Keep the selection valid when the metric list is replaced by API data.
  useEffect(() => {
    if (metrics.length > 0 && !metrics.some(m => m.code === selectedCode)) {
      setSelectedCode(metrics[0].code);
    }
  }, [metrics, selectedCode]);

  // Load real version history for the selected metric (falls back to embedded historyDiff).
  useEffect(() => {
    const code = selectedMetric?.code;
    if (!code) return;
    let cancelled = false;
    metricApi.history(code)
      .then((rows: any[]) => {
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return;
        setRemoteHistory(prev => ({
          ...prev,
          [code]: rows.map(r => ({
            version: r.version ?? '',
            date: String(r.createdAt ?? '').slice(0, 10),
            diff: r.diff ?? '',
            breakingHistoryData: !!r.breakingHistoryData,
          })),
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedMetric?.code]);

  const selectedHistory = selectedMetric
    ? remoteHistory[selectedMetric.code] ?? selectedMetric.historyDiff
    : undefined;

  const filteredMetrics = metrics.filter(m => {
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchName = m.name.toLowerCase().includes(q);
      const matchCode = m.code.toLowerCase().includes(q);
      const matchCaliber = m.caliberSummary.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchCaliber) return false;
    }
    if (filterType !== 'ALL' && m.type !== filterType) return false;
    // Quick problem filters from the audit report: unstamped (no physical binding) / composite DAG
    if (quickFilter === 'MISSING_CODE' && (m.referencedColumns?.length ?? 0) > 0) return false;
    if (quickFilter === 'COMPOSITE_DAG' && !(m.type === 'COMPOSITE' && (m.upstreamMetrics?.length ?? 0) > 0)) return false;
    return true;
  });

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950">
      {/* Left List of Metrics */}
      <div className="w-80 sm:w-96 border-r border-slate-800 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <Binary className="w-5 h-5 text-cyan-400" />
              <span>M5 指标中心与三级溯源</span>
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {metrics.length} 项治理指标
            </span>
          </div>
          <p className="text-xs text-slate-400">
            承接指标核对差异报告：统一结构化口径、监管体系分类与字段级穿透
          </p>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索指标名、编码 (MET-...)、或口径..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Quick Problem Filters (directly from audit report) */}
          <div className="flex flex-wrap gap-1 text-[11px]">
            <button
              onClick={() => setQuickFilter('ALL')}
              className={`px-2 py-0.5 rounded transition ${quickFilter === 'ALL' ? 'bg-cyan-600 text-white font-medium' : 'bg-slate-900 text-slate-400'}`}
            >
              全部指标
            </button>
            <button
              onClick={() => setQuickFilter('MISSING_CODE')}
              className={`px-2 py-0.5 rounded transition ${quickFilter === 'MISSING_CODE' ? 'bg-amber-600 text-white font-medium' : 'bg-slate-900 text-slate-400'}`}
              title="报告重点问题：无唯一标准编码"
            >
              未赋码指标
            </button>
            <button
              onClick={() => setQuickFilter('COMPOSITE_DAG')}
              className={`px-2 py-0.5 rounded transition ${quickFilter === 'COMPOSITE_DAG' ? 'bg-indigo-600 text-white font-medium' : 'bg-slate-900 text-slate-400'}`}
              title="报告重点问题：复合指标依赖未结构化"
            >
              复合依赖图
            </button>
          </div>
        </div>

        {/* Metrics List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
          {filteredMetrics.map(m => {
            const isSelected = selectedCode === m.code;
            return (
              <div
                key={m.code}
                onClick={() => setSelectedCode(m.code)}
                className={`p-3.5 cursor-pointer transition text-xs space-y-1.5 ${
                  isSelected ? 'bg-cyan-950/30 border-l-4 border-cyan-500' : 'hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-cyan-400 font-semibold">{m.code}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                      {m.version}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      {m.status}
                    </span>
                  </div>
                </div>

                <div className="font-semibold text-slate-200 text-[13px]">{m.name}</div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {m.caliberSummary}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>Owner: {m.owner.split(' ')[0]}</span>
                  <span className="text-indigo-400">{m.downstreamReports.length} 个下游消费报表</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Metric Details & 3-Level Tracing */}
      {selectedMetric && (
        <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
          {/* Top Title Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {selectedMetric.code}
                </span>
                <h2 className="text-lg font-bold text-white">{selectedMetric.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  版本: {selectedMetric.version}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                业务实体: <strong className="text-slate-200">{selectedMetric.entity}</strong> ｜ 
                口径体系: <strong className="text-cyan-400 font-mono">{selectedMetric.caliberSystem}</strong> (呼应核对报告标准)
              </p>
            </div>

            <button
              onClick={() => onExploreLineage(`asset:metric:${selectedMetric.code.toLowerCase()}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>探索该指标图谱</span>
            </button>
          </div>

          {/* Level 1: Caliber Card */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>一级：业务口径定义卡 (Business Caliber Card)</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">
                计算类型: {selectedMetric.calcType === 'PERIOD' ? '期间指标' : '时点指标'} | 频率: {selectedMetric.frequency}
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-200 leading-relaxed">
              {selectedMetric.caliberSummary}
            </div>

            {/* Formula Expression AST */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">核心度量表达式 (Measure Expression)</span>
                <code className="text-emerald-400 font-mono font-semibold text-xs block">
                  {selectedMetric.measureExpr}
                </code>
                <span className="text-[10px] text-slate-400 block">计量单位: {selectedMetric.unit}</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">口径过滤条件 (Filters)</span>
                <div className="space-y-0.5">
                  {selectedMetric.filterConditions.map((f, i) => (
                    <div key={i} className="font-mono text-cyan-300 text-[11px]">
                      • {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Level 2: Computation Logic DAG */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <GitFork className="w-4 h-4 text-indigo-400" />
              <span>二级：计算逻辑依赖 DAG (Computation Dependency DAG)</span>
            </h3>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">上游指标依赖:</span>
                {selectedMetric.upstreamMetrics && selectedMetric.upstreamMetrics.length > 0 ? (
                  selectedMetric.upstreamMetrics.map(u => (
                    <span key={u} className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-mono">
                      {u}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 italic">基础原子指标 (无上游复合依赖)</span>
                )}
              </div>

              <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                ✓ 拓扑检测: 无环路 (Acyclic Passed)
              </span>
            </div>
          </div>

          {/* Level 3: Physical Column Mapping */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>三级：底层物理字段映射落点 (Physical Column Mapping)</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                穿透至 ODS/DWD/DWS 存储表字段
              </span>
            </div>

            <div className="space-y-2">
              {selectedMetric.referencedColumns.map((ref, idx) => (
                <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-mono text-white font-semibold flex items-center gap-1.5">
                        <span>{ref.assetName}</span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        <span className="text-emerald-400">{ref.columnName}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        绑定资产 ID: {ref.assetId}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-emerald-400 text-xs">置信度: {ref.confidence}%</span>
                    <button
                      onClick={() => onExploreLineage(ref.assetId)}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      查看表血缘 →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Version Diff & Historical Data Comparability Alert */}
          {selectedHistory && selectedHistory.length > 0 && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400" />
                  <span>口径版本演进历史与历史数据可比性评估</span>
                </h3>
              </div>

              <div className="space-y-2">
                {selectedHistory.map((h, i) => (
                  <div key={i} className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">{h.version}</span>
                        <span className="text-[10px] text-slate-400">{h.date}</span>
                      </div>
                      {h.breakingHistoryData && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>历史数据不可直接横向比较 (口径断点)</span>
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {h.diff}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
