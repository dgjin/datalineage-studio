import React, { useEffect, useState } from 'react';
import { 
  Asset, 
  ChangeType, 
  ImpactVerdict, 
  ImpactReport, 
  ImpactItem,
  ColumnDefinition
} from '../../types/lineage';
import { impactApi, changeApi, assetApi } from '../../services/api';
import { 
  AlertOctagon, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Check, 
  X, 
  Clock, 
  User, 
  FileCode, 
  ArrowRight, 
  Sparkles, 
  Copy, 
  Send,
  Layers,
  ChevronRight
} from 'lucide-react';

interface M3ImpactAnalysisProps {
  assets: Asset[];
  defaultAssetId?: string;
  onExploreLineage: (assetId: string) => void;
}

export const M3ImpactAnalysis: React.FC<M3ImpactAnalysisProps> = ({
  assets,
  defaultAssetId = 'asset:ods_crm_customer',
  onExploreLineage
}) => {
  const [selectedAssetId, setSelectedAssetId] = useState<string>(defaultAssetId);
  const [changeType, setChangeType] = useState<ChangeType>('DROP_COLUMN');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [report, setReport] = useState<ImpactReport | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [linkedChangeId, setLinkedChangeId] = useState<string | null>(null);
  const [ackSaving, setAckSaving] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  // Modal states for Ack & Exemption
  const [activeAckItem, setActiveAckItem] = useState<ImpactItem | null>(null);
  const [exemptionReason, setExemptionReason] = useState('');
  const [showAckSuccessToast, setShowAckSuccessToast] = useState<string | null>(null);

  const selectedAsset = assets.find(a => a.id === selectedAssetId) || assets[0];

  // Keep the asset selection valid when the dataset switches between mock and real
  useEffect(() => {
    if (assets.length === 0) return;
    if (!assets.some(a => a.id === selectedAssetId)) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  // Load the real columns of the selected asset for the target-column picker
  useEffect(() => {
    let cancelled = false;
    if (!selectedAssetId) return;
    assetApi.getColumns(selectedAssetId)
      .then(rows => {
        if (cancelled) return;
        const cols: ColumnDefinition[] = (rows ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          type: c.type ?? 'UNKNOWN',
          nullable: c.nullable ?? true,
          comment: c.comment ?? '',
          isPrimary: c.isPrimary ?? false,
          isPii: c.isPii ?? false,
          sensitivity: c.sensitivity ?? '内部',
        }));
        setColumns(cols);
        setSelectedColumn(cols[0]?.name ?? '');
      })
      .catch(() => {
        if (!cancelled) {
          setColumns([]);
          setSelectedColumn('');
        }
      });
    return () => { cancelled = true; };
  }, [selectedAssetId]);

  const handleRunSimulation = async () => {
    if (!selectedAsset) return;
    setIsSimulating(true);
    setSimError(null);
    try {
      const useColumn = ['DROP_COLUMN', 'RENAME_COLUMN', 'CHANGE_DATA_TYPE'].includes(changeType);
      const sim = await impactApi.simulate({
        assetId: selectedAsset.id,
        changeType,
        columnName: useColumn ? (selectedColumn || undefined) : undefined,
      });

      // Link an existing open change event for this asset so Ack persists against it
      let linkedChange: any = null;
      try {
        const existing = await changeApi.byAsset(selectedAsset.id);
        linkedChange = (existing ?? []).find(
          (c: any) => !['RESOLVED', 'REJECTED'].includes(c.status),
        ) ?? null;
      } catch { /* linking is optional */ }
      setLinkedChangeId(linkedChange?.id ?? null);

      const nameById = new Map(assets.map(a => [a.id, a.name]));
      const impacted: any[] = sim.impactedAssets ?? [];

      const directImpacts: ImpactItem[] = impacted.map((a: any) => ({
        id: `imp:${a.assetId}`,
        objectId: a.assetId,
        objectName: `${a.displayTitle ?? a.assetName} (${a.assetName})`,
        type: a.type,
        distance: a.distance,
        via: a.isCriticalPath
          ? `关键传播链路 · ${a.distance} 跳`
          : `血缘传播 · ${a.distance} 跳`,
        owner: a.owner ?? '未指定',
        department: a.department ?? '—',
        ackStatus: 'PENDING',
      }));

      const criticalPaths: string[][] = impacted
        .filter((a: any) => a.isCriticalPath && Array.isArray(a.pathAssetIds) && a.pathAssetIds.length > 1)
        .sort((x: any, y: any) => x.distance - y.distance)
        .slice(0, 3)
        .map((a: any) => a.pathAssetIds.map((id: string) => nameById.get(id) ?? id));

      const total = sim.totalImpacted ?? 0;
      const verdictScore: Record<string, number> = { BLOCKER: 95, HIGH: 78, MEDIUM: 55, LOW: 28, SAFE: 5 };
      const score = Math.max(verdictScore[String(sim.verdict)] ?? 30, Math.min(100, total * 5));

      const suggestions: string[] = [];
      if (sim.recommendation) suggestions.push(sim.recommendation);
      if (sim.blockedCount > 0) {
        suggestions.push(`${sim.blockedCount} 个关键链路资产（报表/指标）将被阻断，需全部 Owner 确认或架构师豁免后方可放行。`);
      }
      switch (String(sim.verdict)) {
        case 'BLOCKER':
          suggestions.push('破坏性变更在全部下游 Owner 确认 (Ack) 前禁止合并入生产主干。');
          break;
        case 'HIGH':
          suggestions.push('请通知全部下游 Owner，并在预定迁移窗口执行变更。');
          break;
        case 'MEDIUM':
          suggestions.push('建议同步更新受影响 API 与报表的字段契约。');
          break;
        case 'LOW':
          suggestions.push('按常规评审流程推进即可，关注下游报表刷新。');
          break;
        default:
          suggestions.push('向下兼容，无需下游确认，可自动放行。');
      }

      const mitigationCodeSnippet = changeType === 'DROP_COLUMN' && selectedColumn && columns.length > 0
        ? buildMitigationSnippet(selectedAsset.name, selectedColumn)
        : undefined;

      setReport({
        assetId: selectedAsset.id,
        assetName: selectedAsset.name,
        changeType,
        targetField: useColumn ? selectedColumn : '',
        verdict: String(sim.verdict) as ImpactVerdict,
        score,
        summary: sim.summary ?? '',
        criticalPaths,
        directImpacts,
        suggestions,
        mitigationCodeSnippet,
      });
    } catch (e: any) {
      setSimError(e?.message ?? '影响预演失败，请确认后端服务已启动');
      setReport(null);
    } finally {
      setIsSimulating(false);
    }
  };

  /** Build a forward-compatibility view template from the real column list. */
  const buildMitigationSnippet = (assetName: string, targetColumn: string): string | undefined => {
    if (columns.length === 0) return undefined;
    const selectList = columns.map(c =>
      c.name === targetColumn
        ? `    NULL AS ${c.name} /* [DEPRECATED] forward-compat stub */`
        : `    ${c.name}`,
    ).join(',\n');
    return `-- Forward-compatibility view for pending DROP_COLUMN of ${assetName}.${targetColumn}\n`
      + `CREATE OR REPLACE VIEW ${assetName}_compat AS\nSELECT\n${selectList}\nFROM ${assetName};`;
  };

  const handleAckAction = async (item: ImpactItem, action: 'ACK' | 'EXEMPT') => {
    if (!report || ackSaving) return;
    setAckSaving(true);
    try {
      // Real governance loop: acks persist against a change event. Reuse the linked
      // open one, or register a planned change event for this asset first.
      let changeId = linkedChangeId;
      if (!changeId) {
        const created = await changeApi.create({
          assetId: report.assetId,
          assetName: report.assetName,
          changeType: report.changeType,
          detectedBy: 'M3_SIMULATOR',
          isManaged: false,
          isBreaking: ['DROP_COLUMN', 'DROP_TABLE', 'RENAME_COLUMN', 'CHANGE_DATA_TYPE'].includes(report.changeType),
          status: 'DETECTED',
          details: { column: report.targetField || null },
        });
        changeId = created?.id ?? null;
        setLinkedChangeId(changeId);
      }
      if (!changeId) throw new Error('无法登记变更事件');

      const ack = await impactApi.acknowledge({
        changeId,
        objectId: item.objectId,
        objectName: item.objectName,
        objectType: item.type,
        distance: item.distance,
        via: item.via,
        owner: item.owner,
        department: item.department,
        ackStatus: action === 'ACK' ? 'ACKED' : 'EXEMPTED',
        exemptReason: action === 'EXEMPT' ? exemptionReason : undefined,
      });

      if (action === 'EXEMPT' && ack?.id) {
        await impactApi.applyExemption({ ackId: ack.id, reason: exemptionReason });
      }

      const updated = report.directImpacts.map(i => {
        if (i.id === item.id) {
          return {
            ...i,
            ackStatus: (action === 'ACK' ? 'ACKED' : 'EXEMPTED') as any,
            exemptReason: action === 'EXEMPT' ? exemptionReason : undefined
          };
        }
        return i;
      });
      setReport({ ...report, directImpacts: updated });
      setActiveAckItem(null);
      setExemptionReason('');
      setShowAckSuccessToast(
        action === 'ACK'
          ? `已为 ${item.objectName} 提交影响确认，归档至变更事件 ${changeId.slice(0, 8)}…`
          : `已为 ${item.objectName} 提交阶段性豁免申请`,
      );
      setTimeout(() => setShowAckSuccessToast(null), 3000);
    } catch (e: any) {
      setShowAckSuccessToast(`操作失败: ${e?.message ?? '未知错误'}`);
      setTimeout(() => setShowAckSuccessToast(null), 4000);
    } finally {
      setAckSaving(false);
    }
  };

  const verdictStyles: Record<ImpactVerdict, { bg: string; text: string; border: string; label: string }> = {
    BLOCKER: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/40', label: '严重风险 (BLOCKER) - 建议阻断' },
    HIGH: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', label: '高风险 (HIGH) - 需全量确认' },
    MEDIUM: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40', label: '中等风险 (MEDIUM)' },
    LOW: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', label: '低风险 (LOW)' },
    SAFE: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', label: '安全无影响 (SAFE) - 自动放行' }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6 space-y-6">
      {/* Toast Notification */}
      {showAckSuccessToast && (
        <div className="fixed bottom-6 right-6 bg-emerald-950 border border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs z-50 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{showAckSuccessToast}</span>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-amber-400" />
            <span>M3 变更影响分析与 What-If 模拟器</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            在改动发生前基于全域静态血缘与运行时 DAG 提前预演，自动分级风险并驱动 Owner 确认闭环
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">CI 检查挂载:</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            lineage-cli 拦截器就绪
          </span>
        </div>
      </div>

      {/* Simulator Inputs Card */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>变更场景预演配置 (What-If Simulation Setup)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Asset picker */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">目标数据资产 (Target Asset)</label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
            >
              {assets.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.layer} - {a.displayTitle})
                </option>
              ))}
            </select>
          </div>

          {/* Change Operation Type */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">变更操作类型 (Operation)</label>
            <select
              value={changeType}
              onChange={(e) => setChangeType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
            >
              <option value="DROP_COLUMN">DROP_COLUMN (删除物理列 - 破坏性)</option>
              <option value="RENAME_COLUMN">RENAME_COLUMN (重命名物理列 - 破坏性)</option>
              <option value="CHANGE_DATA_TYPE">CHANGE_DATA_TYPE (修改数据类型)</option>
              <option value="ADD_NON_NULL_COLUMN">ADD_NON_NULL_COLUMN (新增非空列)</option>
              <option value="ADD_NULLABLE_COLUMN">ADD_NULLABLE_COLUMN (新增可空列 - 兼容)</option>
              <option value="DROP_TABLE">DROP_TABLE (下线整个表对象)</option>
            </select>
          </div>

          {/* Target column (if applicable) */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">目标字段 (Target Column)</label>
            {columns.length > 0 ? (
              <select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
              >
                {columns.map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.type}) {c.isPii ? '[PII]' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                disabled
                value="表级操作，无需指定字段"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-500"
              />
            )}
          </div>
        </div>

        {/* Execute Button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-[11px] text-slate-400">
            预演不会写入生产或修改 Git 契约，仅用于风险评估与提前治理
          </span>
          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-indigo-500/25 disabled:opacity-50"
          >
            {isSimulating ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>图谱拓扑推演中...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>立即运行影响预演分析</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Simulation error banner */}
      {simError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{simError}</span>
        </div>
      )}

      {/* Impact Report Section */}
      {report && (
        <div className="space-y-6">
          {/* Verdict Banner */}
          <div className={`p-4 rounded-xl border ${verdictStyles[report.verdict].bg} ${verdictStyles[report.verdict].border} space-y-2`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className={`w-5 h-5 ${verdictStyles[report.verdict].text}`} />
                <span className={`font-bold text-sm ${verdictStyles[report.verdict].text}`}>
                  {verdictStyles[report.verdict].label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">波及深度指数 (Blast Radius):</span>
                <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800">
                  {report.score} / 100
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {report.summary}
            </p>
          </div>

          {/* Two-Column Grid: Direct Impacts & Critical Paths */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Direct Affected Objects with Ack Workflow */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-400" />
                  <span>受影响资产与 Owner 确认工作台 ({report.directImpacts.length})</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  {linkedChangeId ? `已关联变更事件 ${linkedChangeId.slice(0, 8)}…` : '按波及深度排序'}
                </span>
              </div>

              <div className="space-y-2.5">
                {report.directImpacts.map(item => (
                  <div key={item.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {item.type}
                          </span>
                          <span className="font-semibold text-xs text-white">{item.objectName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          依赖机制: <span className="text-slate-300">{item.via}</span>
                        </div>
                      </div>

                      {/* Ack Status Badge */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                        item.ackStatus === 'ACKED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : item.ackStatus === 'EXEMPTED'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                      }`}>
                        {item.ackStatus === 'ACKED' ? '✓ 已确认受影响' : item.ackStatus === 'EXEMPTED' ? '阶段性豁免中' : '待确认 (Pending Ack)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/60">
                      <span className="text-slate-400">
                        Owner: <strong className="text-slate-200">{item.owner}</strong> ({item.department})
                      </span>

                      {/* Action buttons */}
                      {item.ackStatus === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAckAction(item, 'ACK')}
                            disabled={ackSaving}
                            className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition disabled:opacity-50"
                          >
                            确认影响 (Ack)
                          </button>
                          <button
                            onClick={() => setActiveAckItem(item)}
                            disabled={ackSaving}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition disabled:opacity-50"
                          >
                            申请豁免
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Critical Paths List & Graph preview */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>破坏性关键传播链路 (Critical Impact Paths)</span>
                </h3>
                <button
                  onClick={() => onExploreLineage(report.assetId)}
                  className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1"
                >
                  <span>在 M2 中高亮</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-2">
                {report.criticalPaths.map((path, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-rose-500/30 space-y-2">
                    <div className="text-[11px] font-semibold text-rose-300 flex items-center gap-1">
                      <span>链路 #{idx + 1}</span>
                      <span className="text-slate-500 font-normal">({path.length} 跳断链风险)</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                      {path.map((node, nIdx) => (
                        <React.Fragment key={nIdx}>
                          <span className={`px-2 py-1 rounded border ${
                            nIdx === 0 
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                              : nIdx === path.length - 1
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                              : 'bg-slate-900 text-slate-300 border-slate-800'
                          }`}>
                            {node}
                          </span>
                          {nIdx < path.length - 1 && (
                            <ArrowRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Suggestions */}
              <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                <h4 className="text-xs font-semibold text-slate-300">
                  治理系统推荐行动项 (Recommendations):
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {report.suggestions.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Mitigation Forward-Compatibility Code Snippet */}
          {report.mitigationCodeSnippet && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    自动生成的平滑迁移视图模板 (Auto-Generated Mitigation DDL)
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(report.mitigationCodeSnippet || '');
                    setCopiedSnippet(true);
                    setTimeout(() => setCopiedSnippet(false), 2000);
                  }}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedSnippet ? '已复制 SQL' : '复制代码'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto border border-slate-800 leading-relaxed">
                {report.mitigationCodeSnippet}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Exemption Application Modal */}
      {activeAckItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">申请变更影响阶段性豁免 (Exemption)</h3>
              <button onClick={() => setActiveAckItem(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-1">
              <div className="text-slate-400">受影响对象:</div>
              <div className="font-semibold text-white font-mono bg-slate-950 p-2 rounded border border-slate-800">
                {activeAckItem.objectName}
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">豁免原因说明 (必须经架构师审批):</label>
              <textarea
                rows={3}
                value={exemptionReason}
                onChange={(e) => setExemptionReason(e.target.value)}
                placeholder="例如：下游报表已安排在 10月15日 重构发布，此期间数据可暂容忍历史空值..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setActiveAckItem(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                取消
              </button>
              <button
                onClick={() => handleAckAction(activeAckItem, 'EXEMPT')}
                disabled={!exemptionReason.trim() || ackSaving}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold disabled:opacity-50"
              >
                提交豁免申请并归档
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
