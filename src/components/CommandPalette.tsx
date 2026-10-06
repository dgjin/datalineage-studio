import React, { useState, useEffect } from 'react';
import { Search, Database, GitFork, AlertOctagon, Binary, FileCode, X, ArrowRight, LifeBuoy } from 'lucide-react';
import { Asset, MetricDefinition, ValidationRule } from '../types/lineage';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  metrics: MetricDefinition[];
  rules: ValidationRule[];
  onSelectAsset: (assetId: string) => void;
  onSelectMetric: (metricCode: string) => void;
  onNavigateTab: (tab: any) => void;
  onSimulateChange: (assetId: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  assets,
  metrics,
  rules,
  onSelectAsset,
  onSelectMetric,
  onNavigateTab,
  onSimulateChange
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(query.toLowerCase()) ||
    a.displayTitle.toLowerCase().includes(query.toLowerCase()) ||
    a.columns?.some(c => c.name.toLowerCase().includes(query.toLowerCase()))
  );

  const filteredMetrics = metrics.filter(m => 
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.code.toLowerCase().includes(query.toLowerCase()) ||
    m.caliberSummary.toLowerCase().includes(query.toLowerCase())
  );

  const filteredRules = rules.filter(r => 
    r.name.toLowerCase().includes(query.toLowerCase()) ||
    r.code.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Input Bar */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="搜索资产、字段 (如 col:phone)、指标、校验规则、或输入命令..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Area */}
        <div className="p-3 overflow-y-auto space-y-4 flex-1">
          {/* Quick Shortcuts */}
          {query.trim() === '' && (
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2">
                快捷功能跳转
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => { onNavigateTab('lineage'); onClose(); }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-indigo-300 transition text-left"
                >
                  <GitFork className="w-4 h-4 text-indigo-400" />
                  <span>打开全域血缘探索器 (M2)</span>
                </button>
                <button
                  onClick={() => { onNavigateTab('impact'); onClose(); }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-amber-300 transition text-left"
                >
                  <AlertOctagon className="w-4 h-4 text-amber-400" />
                  <span>发起 What-If 变更模拟器 (M3)</span>
                </button>
                <button
                  onClick={() => { onNavigateTab('changes'); onClose(); }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-rose-300 transition text-left"
                >
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  <span>未纳管暗改专区对账 (M4)</span>
                </button>
                <button
                  onClick={() => { onNavigateTab('metrics'); onClose(); }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition text-left"
                >
                  <Binary className="w-4 h-4 text-cyan-400" />
                  <span>178 项核心指标库 (M5)</span>
                </button>
                <button
                  onClick={() => { onNavigateTab('help'); onClose(); }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 transition text-left"
                >
                  <LifeBuoy className="w-4 h-4 text-emerald-400" />
                  <span>帮助中心 · 操作闭环与配置指南</span>
                </button>
              </div>
            </div>
          )}

          {/* Asset matches */}
          {filteredAssets.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <Database className="w-3 h-3 text-indigo-400" />
                <span>数据资产 ({filteredAssets.length})</span>
              </div>
              <div className="space-y-1">
                {filteredAssets.slice(0, 5).map(asset => (
                  <div 
                    key={asset.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/70 transition group cursor-pointer"
                    onClick={() => { onSelectAsset(asset.id); onClose(); }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {asset.layer}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-200 group-hover:text-indigo-300 truncate">
                          {asset.name} <span className="text-slate-400 font-normal">({asset.displayTitle})</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {asset.description}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSimulateChange(asset.id);
                          onClose();
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 opacity-0 group-hover:opacity-100 transition"
                      >
                        模拟改动
                      </button>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-300" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metric matches */}
          {filteredMetrics.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <Binary className="w-3 h-3 text-cyan-400" />
                <span>核心指标 ({filteredMetrics.length})</span>
              </div>
              <div className="space-y-1">
                {filteredMetrics.slice(0, 4).map(m => (
                  <div
                    key={m.code}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/70 transition group cursor-pointer"
                    onClick={() => { onSelectMetric(m.code); onClose(); }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200 group-hover:text-cyan-300">
                        <span className="font-mono text-cyan-400 text-[10px]">{m.code}</span>
                        <span>{m.name}</span>
                        <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-400">{m.unit}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        公式: {m.measureExpr}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-300 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rules */}
          {filteredRules.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <FileCode className="w-3 h-3 text-amber-400" />
                <span>内置校验规则 ({filteredRules.length})</span>
              </div>
              <div className="space-y-1">
                {filteredRules.slice(0, 3).map(r => (
                  <div
                    key={r.code}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/70 transition group cursor-pointer"
                    onClick={() => { onNavigateTab('validation'); onClose(); }}
                  >
                    <div>
                      <div className="text-xs text-slate-200 group-hover:text-amber-300">
                        <span className="font-mono text-amber-400 font-bold mr-1.5">{r.code}</span>
                        {r.name}
                      </div>
                      <div className="text-[10px] text-slate-400">{r.description}</div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                      {r.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Helper Bar */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>按 <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-300">ESC</kbd> 退出</span>
            <span>按 <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-300">↑↓</kbd> 切换</span>
            <span>按 <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-300">ENTER</kbd> 选定</span>
          </div>
          <span className="text-slate-400 font-mono">元模型索引就绪</span>
        </div>
      </div>
    </div>
  );
};
