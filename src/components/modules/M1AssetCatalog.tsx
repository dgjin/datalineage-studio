import React, { useEffect, useState } from 'react';
import { 
  Asset, 
  LineageEdge, 
  ChangeEvent, 
  QualityIssue 
} from '../../types/lineage';
import { datasourceApi } from '../../services/api';
import { GovernanceHealthPanel } from '../GovernanceHealthPanel';
import { AssetListSkeleton } from '../Skeleton';
import { 
  Search, 
  Filter, 
  Database, 
  ArrowUpRight, 
  ShieldAlert, 
  Layers, 
  GitFork, 
  AlertTriangle, 
  CheckCircle2, 
  Tag, 
  Eye, 
  FileText, 
  Calendar, 
  User, 
  Building2, 
  ExternalLink,
  MessageSquare,
  Sparkles,
  Lock,
  X
} from 'lucide-react';

// Bundled demo discussions, loaded only while demo mode is ON; quasi-production
// starts empty and user comments stay local to the session.
const DEMO_DISCUSSIONS: Record<string, { author: string; time: string; text: string }[]> = {
  'asset:ods_crm_customer': [
    { author: '陈敏 (数据数仓组)', time: '2026-09-28 16:00', text: '已收到 phone 列拟废弃通知，DWD 层正在使用 phone_hash 替代下游关联，请架构师把关。' },
    { author: '张伟 (CRM架构师)', time: '2026-09-28 16:30', text: '好，目前已在 CI 开启卡点保护，等所有下游确认后再合并发布。' }
  ]
};

interface M1AssetCatalogProps {
  assets: Asset[];
  edges: LineageEdge[];
  changes: ChangeEvent[];
  issues: QualityIssue[];
  demoMode: boolean;
  /** True only during the very first backend sync (skeleton state). */
  isLoading?: boolean;
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string | null) => void;
  onExploreLineage: (assetId: string) => void;
  onSimulateChange: (assetId: string) => void;
  onNavigateContract: (contractRef?: string) => void;
}

export const M1AssetCatalog: React.FC<M1AssetCatalogProps> = ({
  assets,
  edges,
  changes,
  issues,
  demoMode,
  isLoading = false,
  selectedAssetId,
  onSelectAsset,
  onExploreLineage,
  onSimulateChange,
  onNavigateContract
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLayer, setSelectedLayer] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedSpace, setSelectedSpace] = useState<string>('ALL');
  const [drawerTab, setDrawerTab] = useState<'OVERVIEW' | 'COLUMNS' | 'LINEAGE' | 'CHANGES' | 'QUALITY' | 'DISCUSS'>('OVERVIEW');
  const [commentInput, setCommentInput] = useState('');
  // Data source id -> name, for the ownership badge (multi-source layer import)
  const [dsNames, setDsNames] = useState<Record<string, string>>({});

  useEffect(() => {
    datasourceApi.list()
      .then(list => {
        const map: Record<string, string> = {};
        (list || []).forEach((d: any) => { map[d.id] = d.name; });
        setDsNames(map);
      })
      .catch(() => {});
  }, []);
  const [comments, setComments] = useState<Record<string, { author: string; time: string; text: string }[]>>({});

  // Swap in the bundled discussions only while demo mode is ON
  useEffect(() => {
    setComments(demoMode ? DEMO_DISCUSSIONS : {});
  }, [demoMode]);

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    // Search syntax: col:xxx
    if (searchTerm.startsWith('col:')) {
      const colQuery = searchTerm.replace('col:', '').trim().toLowerCase();
      const hasCol = asset.columns?.some(c => c.name.toLowerCase().includes(colQuery));
      if (!hasCol) return false;
    } else if (searchTerm.startsWith('id:')) {
      const idQuery = searchTerm.replace('id:', '').trim().toLowerCase();
      if (!asset.id.toLowerCase().includes(idQuery)) return false;
    } else if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchName = asset.name.toLowerCase().includes(q);
      const matchTitle = asset.displayTitle.toLowerCase().includes(q);
      const matchDesc = asset.description.toLowerCase().includes(q);
      const matchOwner = asset.owner.toLowerCase().includes(q);
      const matchCol = asset.columns?.some(c => c.name.toLowerCase().includes(q) || c.comment.toLowerCase().includes(q));
      if (!matchName && !matchTitle && !matchDesc && !matchOwner && !matchCol) return false;
    }

    if (selectedLayer !== 'ALL' && asset.layer !== selectedLayer) return false;
    if (selectedStatus !== 'ALL' && asset.status !== selectedStatus) return false;
    if (selectedSpace !== 'ALL' && asset.space !== selectedSpace) return false;

    return true;
  });

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  const statusBadges: Record<string, { label: string; style: string }> = {
    ACTIVE: { label: '正常 (ACTIVE)', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    STALE: { label: '待确认 (STALE)', style: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    PENDING_CHANGE: { label: '变更中 (PENDING)', style: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    UNMANAGED: { label: '未纳管 (UNMANAGED)', style: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
    DEPRECATED: { label: '已废弃 (DEPRECATED)', style: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
    DRAFT: { label: '草稿 (DRAFT)', style: 'bg-blue-500/10 text-blue-400 border-blue-500/30' }
  };

  const handleAddComment = () => {
    if (!commentInput.trim() || !selectedAssetId) return;
    const newEntry = {
      author: '当前用户 (协作留言)',
      time: '刚刚',
      text: commentInput.trim()
    };
    setComments(prev => ({
      ...prev,
      [selectedAssetId]: [...(prev[selectedAssetId] || []), newEntry]
    }));
    setCommentInput('');
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950">
      {/* Main List Column */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800">
        {/* Sub-header Toolbar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                <span>M1 统一数据资产目录</span>
                <span className="text-xs font-normal text-slate-400 font-mono">({filteredAssets.length} 项)</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                覆盖物理与逻辑元数据，提供精准搜索、敏感标记、置信度与血缘小卡穿透
              </p>
            </div>

            {/* Quick search syntax tips */}
            <div className="text-[11px] text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800 flex items-center gap-2">
              <span className="text-indigo-400 font-semibold">语法提示:</span>
              <code className="text-slate-300">col:phone</code> (搜字段) | 
              <code className="text-slate-300">id:crm</code> (按ID查)
            </div>
          </div>

          {/* Search bar & filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索资产名、描述、口径、Owner，或输入 col:字段名..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Layer Filter */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
              {['ALL', 'ODS', 'DWD', 'DWS', 'ADS', 'APP'].map(layer => (
                <button
                  key={layer}
                  onClick={() => setSelectedLayer(layer)}
                  className={`px-2 py-1 rounded-md transition font-medium ${
                    selectedLayer === layer
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {layer}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">全部状态</option>
              <option value="ACTIVE">正常 (ACTIVE)</option>
              <option value="STALE">待确认 (STALE)</option>
              <option value="PENDING_CHANGE">变更中 (PENDING)</option>
              <option value="UNMANAGED">未纳管暗改 (UNMANAGED)</option>
            </select>

            {/* Space Filter */}
            <select
              value={selectedSpace}
              onChange={(e) => setSelectedSpace(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">全部域空间</option>
              <option value="crm">CRM 客户域</option>
              <option value="trade">交易结算域</option>
              <option value="risk">合规风控域</option>
            </select>
          </div>
        </div>

        {/* Assets Table (skeleton during the first backend sync) */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <AssetListSkeleton />
          ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
              <tr>
                <th className="py-2.5 px-4">资产名称 / 标题</th>
                <th className="py-2.5 px-3">层级 & 类型</th>
                <th className="py-2.5 px-3">域空间</th>
                <th className="py-2.5 px-3">状态</th>
                <th className="py-2.5 px-3">Owner / 部门</th>
                <th className="py-2.5 px-3">下游影响数</th>
                <th className="py-2.5 px-3">置信度</th>
                <th className="py-2.5 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Database className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    未找到匹配资产，请调整搜索词或筛选条件
                  </td>
                </tr>
              ) : (
                filteredAssets.map(asset => {
                  const isSelected = selectedAssetId === asset.id;
                  const statusInfo = statusBadges[asset.status] || { label: asset.status, style: '' };

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => onSelectAsset(asset.id)}
                      className={`cursor-pointer transition hover:bg-slate-900/70 ${
                        isSelected ? 'bg-indigo-950/30 ring-1 ring-inset ring-indigo-500/40' : ''
                      }`}
                    >
                      {/* Name & Title */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200 group-hover:text-indigo-300 font-mono text-[13px] flex items-center gap-1.5">
                          {asset.name}
                          {asset.isManaged === false && (
                            <span className="text-[10px] px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">暗改</span>
                          )}
                        </div>
                        <div className="text-slate-400 text-[11px] truncate max-w-xs">{asset.displayTitle}</div>
                      </td>

                      {/* Layer & Type */}
                      <td className="py-3 px-3">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {asset.layer}
                        </span>
                        <span className="ml-1 text-[11px] text-slate-400">
                          {asset.type}
                        </span>
                        {asset.dataSourceId && dsNames[asset.dataSourceId] && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-teal-300/90" title="归属数据源（分层导入）">
                            <Database className="w-3 h-3" />
                            <span>{dsNames[asset.dataSourceId]}</span>
                          </div>
                        )}
                      </td>

                      {/* Space */}
                      <td className="py-3 px-3">
                        <span className="text-slate-300 text-xs uppercase font-mono">{asset.space}</span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${statusInfo.style}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Owner */}
                      <td className="py-3 px-3">
                        <div className="text-slate-300 text-xs">{asset.owner}</div>
                        <div className="text-[10px] text-slate-400">{asset.department}</div>
                      </td>

                      {/* Downstream */}
                      <td className="py-3 px-3">
                        <span className="font-mono font-semibold text-slate-300">
                          {asset.downstreamCount}
                        </span>
                        <span className="text-slate-400 text-[10px] ml-1">个依赖</span>
                      </td>

                      {/* Confidence */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                asset.confidence >= 90 ? 'bg-emerald-500' : asset.confidence >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                              }`} 
                              style={{ width: `${asset.confidence}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-300">{asset.confidence}%</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onExploreLineage(asset.id)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition"
                            title="在 M2 中探索完整血缘"
                          >
                            <GitFork className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onSimulateChange(asset.id)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition"
                            title="在 M3 中发起变更影响模拟"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* Right 6-Tab Asset Details Drawer */}
      {selectedAsset && (
        <div className="w-96 border-l border-slate-800 bg-slate-900/95 flex flex-col shrink-0 overflow-hidden">
          {/* Drawer Top Header */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-900 flex items-start justify-between">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {selectedAsset.layer}
                </span>
                <span className="text-sm font-bold text-white truncate">{selectedAsset.name}</span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{selectedAsset.displayTitle}</p>
            </div>
            <button
              onClick={() => onSelectAsset(null)}
              className="text-slate-500 hover:text-slate-300 p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Actions Bar */}
          <div className="px-3.5 py-2 border-b border-slate-800 bg-slate-950/60 flex items-center gap-2">
            <button
              onClick={() => onExploreLineage(selectedAsset.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>探索血缘</span>
            </button>
            <button
              onClick={() => onSimulateChange(selectedAsset.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-medium transition"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>分析影响</span>
            </button>
          </div>

          {/* 6 Tabs Switcher */}
          <div className="flex items-center border-b border-slate-800 bg-slate-950/30 text-[11px] font-medium overflow-x-auto">
            {[
              { id: 'OVERVIEW', label: '概览' },
              { id: 'COLUMNS', label: `字段(${selectedAsset.columns?.length || 0})` },
              { id: 'LINEAGE', label: '血缘微图' },
              { id: 'CHANGES', label: '变更历史' },
              { id: 'QUALITY', label: '质量' },
              { id: 'DISCUSS', label: '讨论' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDrawerTab(tab.id as any)}
                className={`py-2 px-3 whitespace-nowrap transition border-b-2 ${
                  drawerTab === tab.id
                    ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* TAB 1: OVERVIEW */}
            {drawerTab === 'OVERVIEW' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    资产描述与业务定义
                  </h4>
                  <p className="text-slate-300 leading-relaxed bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    {selectedAsset.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">负责人 (Owner)</span>
                    <span className="font-semibold text-slate-200">{selectedAsset.owner}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{selectedAsset.ownerEmail}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">所属部门</span>
                    <span className="font-semibold text-slate-200">{selectedAsset.department}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">域: {selectedAsset.space}</span>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">全局资产编码:</span>
                    <span className="font-mono text-indigo-400">{selectedAsset.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">存储引擎格式:</span>
                    <span className="font-mono text-slate-300">{selectedAsset.storageFormat || 'Standard'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">元数据来源:</span>
                    <span className="font-mono text-emerald-400">{selectedAsset.sourceType} ({selectedAsset.confidence}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Git 契约绑定:</span>
                    {selectedAsset.contractRef ? (
                      <button 
                        onClick={() => onNavigateContract(selectedAsset.contractRef)}
                        className="font-mono text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <span>{selectedAsset.contractRef}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-rose-400">无契约 (未纳管)</span>
                    )}
                  </div>
                </div>

                {selectedAsset.tags && (
                  <div>
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      标签与分类
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAsset.tags.map(tag => (
                        <span key={tag} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 治理体检：健康分 / Owner / 契约 / 质量 / 变更 / 僵尸资产 */}
                <GovernanceHealthPanel assetId={selectedAsset.id} />
              </div>
            )}

            {/* TAB 2: COLUMNS */}
            {drawerTab === 'COLUMNS' && (
              <div className="space-y-3">
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>共有 {selectedAsset.columns?.length || 0} 个列定义</span>
                  <span className="text-[10px] text-amber-400">含敏感字段脱敏标记</span>
                </div>

                <div className="space-y-2">
                  {selectedAsset.columns?.map(col => (
                    <div key={col.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {col.isPrimary && (
                            <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">PK</span>
                          )}
                          <span className="font-mono font-semibold text-slate-200">{col.name}</span>
                          <span className="font-mono text-[10px] text-slate-400">{col.type}</span>
                        </div>
                        {col.isPii && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            PII ({col.sensitivity})
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 text-[11px]">{col.comment}</div>
                      {col.sourceExpr && (
                        <div className="text-[10px] font-mono text-cyan-400 bg-slate-900 px-2 py-1 rounded border border-slate-800/80">
                          expr: {col.sourceExpr}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: MICRO LINEAGE */}
            {drawerTab === 'LINEAGE' && (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-400">
                  当前节点上下游 1 跳微图。点击全屏探索进入 M2。
                </p>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      上游来源 (Upstream)
                    </span>
                    <div className="space-y-1">
                      {edges.filter(e => e.to === selectedAsset.id).map(edge => {
                        const source = assets.find(a => a.id === edge.from);
                        return (
                          <div key={edge.id} className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                            <span className="font-mono text-slate-200 font-medium">{source?.name || edge.from}</span>
                            <span className="text-[10px] font-mono text-emerald-400">{edge.confidence}%</span>
                          </div>
                        );
                      })}
                      {edges.filter(e => e.to === selectedAsset.id).length === 0 && (
                        <div className="text-slate-400 italic text-[11px]">无上游依赖 (源头节点)</div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      下游影响 (Downstream)
                    </span>
                    <div className="space-y-1">
                      {edges.filter(e => e.from === selectedAsset.id).map(edge => {
                        const target = assets.find(a => a.id === edge.to);
                        return (
                          <div key={edge.id} className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                            <span className="font-mono text-slate-200 font-medium">{target?.name || edge.to}</span>
                            <span className="text-[10px] font-mono text-emerald-400">{edge.confidence}%</span>
                          </div>
                        );
                      })}
                      {edges.filter(e => e.from === selectedAsset.id).length === 0 && (
                        <div className="text-slate-400 italic text-[11px]">无下游消费 (终点节点)</div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onExploreLineage(selectedAsset.id)}
                  className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition text-center"
                >
                  进入 M2 全域画布探索
                </button>
              </div>
            )}

            {/* TAB 4: CHANGES */}
            {drawerTab === 'CHANGES' && (
              <div className="space-y-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  该资产关联的变更事件 (ChangeEvent)
                </span>
                {changes.filter(c => c.assetId === selectedAsset.id).length === 0 ? (
                  <div className="text-slate-400 italic p-4 text-center">近 90 天无变更记录</div>
                ) : (
                  changes.filter(c => c.assetId === selectedAsset.id).map(chg => (
                    <div key={chg.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-400">{chg.changeType}</span>
                        <span className="text-[10px] text-slate-400">{chg.timestamp}</span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{chg.impactSummary}</p>
                      <pre className="p-2 rounded bg-slate-900 text-[10px] font-mono text-slate-300 overflow-x-auto border border-slate-800">
                        {chg.details.rawDiff}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 5: QUALITY */}
            {drawerTab === 'QUALITY' && (
              <div className="space-y-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  数据质量与问题台账
                </span>
                {issues.filter(i => i.affectedAssetId === selectedAsset.id).length === 0 ? (
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
                    未发现未解决的质量缺陷
                  </div>
                ) : (
                  issues.filter(i => i.affectedAssetId === selectedAsset.id).map(iss => (
                    <div key={iss.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-rose-400">{iss.code}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {iss.priority}
                        </span>
                      </div>
                      <h5 className="font-semibold text-white">{iss.title}</h5>
                      <p className="text-slate-400 text-[11px]">{iss.description}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                        <span>责任: {iss.ownerDept}</span>
                        <span>截止: {iss.dueDate}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 6: DISCUSS */}
            {drawerTab === 'DISCUSS' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {(comments[selectedAsset.id] || []).map((c, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-indigo-300">{c.author}</span>
                        <span className="text-slate-400">{c.time}</span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{c.text}</p>
                    </div>
                  ))}
                  {(!comments[selectedAsset.id] || comments[selectedAsset.id].length === 0) && (
                    <div className="text-slate-400 text-center py-4">暂无讨论记录，可以在此留言@架构师</div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <textarea
                    rows={3}
                    placeholder="输入协作留言或口径讨论 (支持 @人)..."
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleAddComment}
                    className="w-full py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
                  >
                    发送留言
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
