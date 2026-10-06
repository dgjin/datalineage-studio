import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Database,
  Upload,
  GitCompare,
  AlertOctagon,
  FileText,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  Table2,
  Columns3,
  ArrowRight,
  Download,
  Server,
  FileUp,
} from 'lucide-react';
import { modelApi, datasourceApi } from '../../services/api';

type TabKey = 'IMPORT' | 'DIFF' | 'IMPACT';

/**
 * M13 数据模型前置管理 - design-time model baseline loop:
 * import ERMaster .erm models, diff against live ODS schema, and auto-evaluate
 * downstream impact on DWD / DWS / ADS / APP layers.
 */
export const M13DataModelHub: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('IMPORT');
  const [models, setModels] = useState<any[]>([]);
  const [dataSources, setDataSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [diffReport, setDiffReport] = useState<any | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import form state
  const [importName, setImportName] = useState('');
  const [importLayer, setImportLayer] = useState('ODS');
  const [importDsId, setImportDsId] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [modelList, dsList] = await Promise.all([
        modelApi.list(),
        datasourceApi.list(),
      ]);
      setModels(modelList);
      setDataSources(dsList);
      if (!selectedModelId && modelList.length > 0) {
        setSelectedModelId(modelList[0].id);
      }
      if (!importDsId && dsList.length > 0) {
        setImportDsId(dsList[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedModelId, importDsId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImport = async () => {
    if (!importFile || !importName.trim()) {
      setImportMsg('请填写模型名称并选择 .erm 文件');
      return;
    }
    setImporting(true);
    setImportMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('name', importName.trim());
      formData.append('targetLayer', importLayer);
      if (importDsId) formData.append('targetDataSourceId', importDsId);
      await modelApi.import(formData);
      setImportMsg('导入成功');
      setImportName('');
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (e: any) {
      setImportMsg(`导入失败: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const runDiff = async () => {
    if (!selectedModelId) return;
    setDiffLoading(true);
    setDiffReport(null);
    try {
      const report = await modelApi.diff(selectedModelId);
      setDiffReport(report);
      setTab('DIFF');
    } catch (e: any) {
      alert(`对比失败: ${e.message}`);
    } finally {
      setDiffLoading(false);
    }
  };

  const selectedModel = models.find(m => m.id === selectedModelId);

  const diffTypeBadge = (type: string) => {
    switch (type) {
      case 'MISSING_IN_ODS': return { label: '表缺失', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
      case 'EXTRA_IN_ODS': return { label: '表多余', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'COLUMN_MISSING': return { label: '字段缺失', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
      case 'COLUMN_EXTRA_IN_ODS': return { label: '字段多余', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'COLUMN_TYPE_MISMATCH': return { label: '类型不一致', cls: 'bg-orange-500/20 text-orange-300 border-orange-500/30' };
      case 'COLUMN_NULLABILITY_MISMATCH': return { label: '可空性不一致', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
      default: return { label: type, cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
    }
  };

  const verdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'BLOCKER': return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'HIGH': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'MEDIUM': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'LOW': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/40 flex items-center justify-center">
              <Database className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">M13 数据模型前置管理</h1>
              <p className="text-[10px] text-slate-400">
                导入 ERMaster 设计模型 → 与实际 ODS 库对比 → 自动评估下游分层影响
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          {[
            { id: 'IMPORT' as TabKey, label: '模型导入', icon: Upload },
            { id: 'DIFF' as TabKey, label: '差异对比', icon: GitCompare },
            { id: 'IMPACT' as TabKey, label: '影响评估', icon: AlertOctagon },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
                  tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ==================== IMPORT TAB ==================== */}
        {tab === 'IMPORT' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Import form */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileUp className="w-4 h-4 text-indigo-400" />
                <span>导入 ERMaster 模型</span>
              </h2>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">模型名称</label>
                  <input
                    type="text"
                    value={importName}
                    onChange={e => setImportName(e.target.value)}
                    placeholder="如：客户域开发版 v2.3"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">目标分层</label>
                    <select
                      value={importLayer}
                      onChange={e => setImportLayer(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="ODS">ODS</option>
                      <option value="DWD">DWD</option>
                      <option value="DWS">DWS</option>
                      <option value="ADS">ADS</option>
                      <option value="APP">APP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">对比数据源</label>
                    <select
                      value={importDsId}
                      onChange={e => setImportDsId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      {dataSources.map(ds => (
                        <option key={ds.id} value={ds.id}>{ds.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">ERMaster 文件 (.erm)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".erm,.xml"
                    onChange={e => setImportFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-indigo-600 file:text-white file:text-xs file:cursor-pointer"
                  />
                  {importFile && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      已选择: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  {importing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{importing ? '导入中...' : '导入模型'}</span>
                </button>

                {importMsg && (
                  <div className={`p-2.5 rounded-lg text-[11px] ${
                    importMsg.includes('成功')
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  }`}>
                    {importMsg}
                  </div>
                )}
              </div>
            </div>

            {/* Model list */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>已导入模型 ({models.length})</span>
              </h2>

              {models.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  暂无数据模型，请从左侧导入 ERMaster .erm 文件
                </div>
              ) : (
                <div className="space-y-2">
                  {models.map(m => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedModelId(m.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition ${
                        selectedModelId === m.id
                          ? 'bg-indigo-500/10 border-indigo-500/40'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">{m.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            {m.version}
                          </span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                          m.status === 'BASELINE'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {m.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Table2 className="w-3 h-3" /> {m.tableCount} 表
                        </span>
                        <span className="flex items-center gap-1">
                          <Columns3 className="w-3 h-3" /> {m.columnCount} 字段
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" /> {m.targetLayer}
                        </span>
                        {m.fileName && <span className="text-slate-500">{m.fileName}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedModel && (
                <button
                  onClick={runDiff}
                  disabled={diffLoading}
                  className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  {diffLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
                  <span>{diffLoading ? '对比中...' : '与实际 ODS 库对比'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ==================== DIFF TAB ==================== */}
        {tab === 'DIFF' && (
          <div className="space-y-4">
            {!diffReport ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                请先在「模型导入」页签选择模型并点击「与实际 ODS 库对比」
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
                    <div className="text-lg font-bold text-white font-mono">{diffReport.totalDifferences}</div>
                    <div className="text-[10px] text-slate-400">差异总数</div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
                    <div className="text-lg font-bold text-rose-400 font-mono">
                      {diffReport.differences.filter((d: any) => d.diffType === 'MISSING_IN_ODS' || d.diffType === 'COLUMN_MISSING').length}
                    </div>
                    <div className="text-[10px] text-slate-400">缺失项</div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
                    <div className="text-lg font-bold text-amber-400 font-mono">
                      {diffReport.differences.filter((d: any) => d.diffType === 'EXTRA_IN_ODS' || d.diffType === 'COLUMN_EXTRA_IN_ODS').length}
                    </div>
                    <div className="text-[10px] text-slate-400">多余项</div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
                    <div className="text-lg font-bold text-orange-400 font-mono">
                      {diffReport.differences.filter((d: any) => d.diffType.includes('MISMATCH')).length}
                    </div>
                    <div className="text-[10px] text-slate-400">不一致项</div>
                  </div>
                </div>

                {/* Diff table */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <GitCompare className="w-4 h-4 text-violet-400" />
                      <span>差异明细 — {diffReport.modelName} vs {diffReport.dataSourceName} ({diffReport.targetLayer})</span>
                    </h3>
                    <span className="text-[10px] text-slate-500 font-mono">{diffReport.comparedAt}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="px-4 py-2 text-left font-medium">表名</th>
                          <th className="px-4 py-2 text-left font-medium">字段</th>
                          <th className="px-4 py-2 text-left font-medium">差异类型</th>
                          <th className="px-4 py-2 text-left font-medium">模型值</th>
                          <th className="px-4 py-2 text-left font-medium">实际值</th>
                          <th className="px-4 py-2 text-left font-medium">说明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffReport.differences.map((d: any, i: number) => {
                          const badge = diffTypeBadge(d.diffType);
                          return (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                              <td className="px-4 py-2 font-mono text-white">{d.tableName}</td>
                              <td className="px-4 py-2 font-mono text-slate-300">{d.columnName || '-'}</td>
                              <td className="px-4 py-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-4 py-2 font-mono text-slate-400">{d.modelValue || '-'}</td>
                              <td className="px-4 py-2 font-mono text-slate-400">{d.actualValue || '-'}</td>
                              <td className="px-4 py-2 text-slate-400">{d.message}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ==================== IMPACT TAB ==================== */}
        {tab === 'IMPACT' && (
          <div className="space-y-4">
            {!diffReport ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                请先执行差异对比，影响评估将自动基于差异结果生成
              </div>
            ) : (
              <>
                {/* Layer impact summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(diffReport.layerImpact || {}).map(([layer, count]) => (
                    <div key={layer} className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center">
                      <div className="text-2xl font-bold text-white font-mono">{count as number}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{layer} 层受影响资产</div>
                    </div>
                  ))}
                </div>

                {/* Per-difference impact cards */}
                <div className="space-y-3">
                  {diffReport.differences
                    .filter((d: any) => d.impact)
                    .map((d: any, i: number) => {
                      const badge = diffTypeBadge(d.diffType);
                      const impact = d.impact;
                      return (
                        <div key={i} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white font-mono">{d.tableName}</span>
                              {d.columnName && (
                                <span className="text-[10px] text-slate-400 font-mono">.{d.columnName}</span>
                              )}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${verdictBadge(impact.verdict)}`}>
                              {impact.verdict}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400">{impact.summary}</p>

                          {impact.impactedAssets && impact.impactedAssets.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider">受影响下游资产</div>
                              <div className="space-y-1">
                                {impact.impactedAssets.slice(0, 5).map((a: any, ai: number) => (
                                  <div key={ai} className="flex items-center gap-2 text-[11px] text-slate-300">
                                    <span className="text-[10px] px-1 py-0.5 rounded bg-slate-800 text-slate-400 font-mono w-10 text-center">
                                      {a.layer}
                                    </span>
                                    <span className="font-mono">{a.assetName}</span>
                                    <span className="text-slate-500">({a.distance} 跳)</span>
                                    {a.isCriticalPath && (
                                      <span className="text-[10px] text-rose-400 font-bold">关键路径</span>
                                    )}
                                  </div>
                                ))}
                                {impact.impactedAssets.length > 5 && (
                                  <div className="text-[10px] text-slate-500 pl-12">
                                    ... 共 {impact.impactedAssets.length} 项
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {diffReport.differences.filter((d: any) => d.impact).length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      所有差异项均未在血缘图中找到对应资产，无下游影响
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
