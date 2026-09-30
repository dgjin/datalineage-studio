import React from 'react';
import { Asset, LineageEdge } from '../types/lineage';
import { ArrowRight, GitFork, Shield, User, ExternalLink } from 'lucide-react';

interface AssetMiniCardProps {
  asset: Asset;
  edges: LineageEdge[];
  allAssets: Asset[];
  onExploreFullLineage: (assetId: string) => void;
  onClose?: () => void;
}

export const AssetMiniCard: React.FC<AssetMiniCardProps> = ({
  asset,
  edges,
  allAssets,
  onExploreFullLineage,
  onClose
}) => {
  // 1-hop upstream
  const upstreamEdges = edges.filter(e => e.to === asset.id);
  const upstreamAssets = upstreamEdges.map(e => allAssets.find(a => a.id === e.from)).filter(Boolean) as Asset[];

  // 1-hop downstream
  const downstreamEdges = edges.filter(e => e.from === asset.id);
  const downstreamAssets = downstreamEdges.map(e => allAssets.find(a => a.id === e.to)).filter(Boolean) as Asset[];

  const statusColors: Record<string, string> = {
    ACTIVE: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    STALE: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    PENDING_CHANGE: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    UNMANAGED: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    DEPRECATED: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    DRAFT: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
  };

  return (
    <div className="w-80 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-3.5 text-xs text-slate-200 z-50">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
              {asset.layer}
            </span>
            <span className="font-semibold text-white truncate max-w-[170px]">{asset.name}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{asset.displayTitle}</p>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusColors[asset.status] || ''}`}>
          {asset.status}
        </span>
      </div>

      {/* Meta Properties */}
      <div className="grid grid-cols-2 gap-2 my-2.5 text-[11px] bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
        <div>
          <span className="text-slate-400">Owner:</span>
          <div className="font-medium text-slate-300 truncate">{asset.owner}</div>
        </div>
        <div>
          <span className="text-slate-400">置信度:</span>
          <div className="font-medium text-emerald-400">{asset.confidence}% ({asset.sourceType})</div>
        </div>
      </div>

      {/* 1-Hop Micro Graph Visualization */}
      <div className="my-2.5">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          上下游 1 跳微图谱 (Micro Lineage)
        </div>
        <div className="flex items-center justify-between gap-1 text-[10px] bg-slate-950 p-2 rounded-lg border border-slate-800">
          {/* Upstream Preview */}
          <div className="flex-1 min-w-0">
            <div className="text-slate-400 mb-1">上游来源 ({upstreamAssets.length})</div>
            {upstreamAssets.length === 0 ? (
              <span className="text-slate-400 italic">源头资产</span>
            ) : (
              <div className="space-y-1">
                {upstreamAssets.slice(0, 2).map(u => (
                  <div key={u.id} className="truncate bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300">
                    {u.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-1 text-slate-400 flex flex-col items-center">
            <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
          </div>

          {/* Current Node */}
          <div className="flex-1 min-w-0 text-center">
            <div className="text-indigo-400 mb-1 font-semibold">当前节点</div>
            <div className="truncate bg-indigo-950/60 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/40 font-mono font-medium">
              {asset.name}
            </div>
          </div>

          <div className="px-1 text-slate-400 flex flex-col items-center">
            <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
          </div>

          {/* Downstream Preview */}
          <div className="flex-1 min-w-0">
            <div className="text-slate-400 mb-1">下游影响 ({downstreamAssets.length})</div>
            {downstreamAssets.length === 0 ? (
              <span className="text-slate-400 italic">消费终点</span>
            ) : (
              <div className="space-y-1">
                {downstreamAssets.slice(0, 2).map(d => (
                  <div key={d.id} className="truncate bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300">
                    {d.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          字段: {asset.columns?.length || 0} 列
        </span>
        <button
          onClick={() => onExploreFullLineage(asset.id)}
          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
        >
          <GitFork className="w-3.5 h-3.5" />
          <span>进入探索器</span>
          <ExternalLink className="w-3 h-3 ml-0.5" />
        </button>
      </div>
    </div>
  );
};
