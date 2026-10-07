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
  History,
  Pencil,
  Trash2,
  X,
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
  const [diffKeyword, setDiffKeyword] = useState('');
  const [diffTypeFilter, setDiffTypeFilter] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Version management state (every import is archived; re-import bumps the version chain)
  const [versions, setVersions] = useState<any[]>([]);
  const [versionFrom, setVersionFrom] = useState<number | null>(null);
  const [versionTo, setVersionTo] = useState<number | null>(null);
  const [versionDiff, setVersionDiff] = useState<any | null>(null);
  const [versionDiffLoading, setVersionDiffLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Import form state
  const [importName, setImportName] = useState('');
  const [importLayer, setImportLayer] = useState('ODS');
  const [importDsId, setImportDsId] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // Model maintenance state (rename / re-target / status / delete)
  const [editingModel, setEditingModel] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', targetLayer: 'ODS', status: 'DRAFT', targetDataSourceId: '' });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [maintainMsg, setMaintainMsg] = useState<string | null>(null);

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

  // Load the version chain whenever the selected model changes
  useEffect(() => {
    if (!selectedModelId) {
      setVersions([]);
      setVersionDiff(null);
      return;
    }
    let cancelled = false;
    modelApi.versions(selectedModelId).then(list => {
      if (cancelled) return;
      const items = list || [];
      setVersions(items);
      setVersionTo(items.length > 0 ? items[0].versionNo : null);
      // Default baseline: previous version, or explicit empty baseline (0) for v1
      setVersionFrom(items.length > 1 ? items[1].versionNo : 0);
      setVersionDiff(null);
    }).catch(() => {
      if (!cancelled) {
        setVersions([]);
        setVersionDiff(null);
      }
    });
    return () => { cancelled = true; };
  }, [selectedModelId]);

  const handleImport = async () => {
    if (!importFile || !importName.trim()) {
      setImportMsg('请填写模型名称并选择模型文件（.erm / .pdm）');
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
      const imported = await modelApi.import(formData);
      setImportMsg(`导入成功：${imported.name} ${imported.version}（${imported.tableCount} 表 / ${imported.columnCount} 字段）`);
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

  const runVersionDiff = async () => {
    if (!selectedModelId || versionTo === null) return;
    setVersionDiffLoading(true);
    try {
      const report = await modelApi.versionDiff(
        selectedModelId,
        versionFrom === null ? undefined : versionFrom,
        versionTo
      );
      setVersionDiff(report);
    } catch (e: any) {
      alert(`版本对比失败: ${e.message}`);
    } finally {
      setVersionDiffLoading(false);
    }
  };

  const handleExportDiff = async (format: 'markdown' | 'csv') => {
    if (!selectedModelId || versionTo === null) return;
    setExporting(true);
    try {
      const { fileName } = await modelApi.exportCompare(
        selectedModelId,
        format,
        versionFrom === null ? undefined : versionFrom,
        versionTo
      );
      setImportMsg(`差异报告已导出：${fileName}`);
    } catch (e: any) {
      alert(`导出失败: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const selectedModel = models.find(m => m.id === selectedModelId);

  // ---- Model maintenance actions ----

  const openEditModal = (m: any) => {
    setEditForm({
      name: m.name || '',
      targetLayer: m.targetLayer || 'ODS',
      status: m.status || 'DRAFT',
      targetDataSourceId: m.targetDataSourceId || '',
    });
    setEditError(null);
    setEditingModel(m);
  };

  const handleSaveEdit = async () => {
    if (!editingModel) return;
    if (!editForm.name.trim()) {
      setEditError('模型名称不能为空');
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const updated = await modelApi.update(editingModel.id, {
        name: editForm.name.trim(),
        targetLayer: editForm.targetLayer,
        status: editForm.status,
        targetDataSourceId: editForm.targetDataSourceId,
      });
      setEditingModel(null);
      setMaintainMsg(`模型「${updated.name}」已更新（目标分层 ${updated.targetLayer} · 状态 ${updated.status}）`);
      load();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModel = async (m: any) => {
    if (!confirm(`确认删除模型「${m.name}」？将连带删除其表结构快照（${m.tableCount} 张表 / ${m.columnCount} 字段）与全部版本历史，操作不可恢复。`)) return;
    setDeleting(true);
    setMaintainMsg(null);
    try {
      await modelApi.remove(m.id);
      const list = await modelApi.list();
      setModels(list);
      if (selectedModelId === m.id) {
        setSelectedModelId(list.length > 0 ? list[0].id : null);
        setVersionDiff(null);
      }
      if (diffReport && diffReport.modelName === m.name) setDiffReport(null);
      setMaintainMsg(`模型「${m.name}」已删除（含表结构快照与版本历史）`);
    } catch (e: any) {
      setMaintainMsg(`删除失败: ${e.message}`);
    } finally {
      setDeleting(false);
    }
  };

  /** Flattened version-diff rows for the compare result table. */
  const versionDiffRows = (() => {
    if (!versionDiff) return [] as any[];
    const rows: any[] = [];
    (versionDiff.tablesAdded || []).forEach((t: any) =>
      rows.push({ type: '表新增', cls: 'text-emerald-300', table: t.table, column: '-', from: '-', to: `${t.columns} 字段` }));
    (versionDiff.tablesRemoved || []).forEach((t: any) =>
      rows.push({ type: '表删除', cls: 'text-rose-300', table: t.table, column: '-', from: `${t.columns} 字段`, to: '-' }));
    (versionDiff.columnsAdded || []).forEach((c: any) =>
      rows.push({ type: '字段新增', cls: 'text-emerald-300', table: c.table, column: c.column, from: '-', to: c.toType }));
    (versionDiff.columnsRemoved || []).forEach((c: any) =>
      rows.push({ type: '字段删除', cls: 'text-rose-300', table: c.table, column: c.column, from: c.fromType, to: '-' }));
    (versionDiff.columnsChanged || []).forEach((c: any) =>
      rows.push({ type: '字段变更', cls: 'text-amber-300', table: c.table, column: c.column, from: c.fromType, to: c.toType }));
    return rows;
  })();

  /** Filtered differences for the DIFF tab: keyword + type filter. */
  const filteredDifferences = (() => {
    if (!diffReport) return [];
    let list = diffReport.differences;
    if (diffTypeFilter) {
      list = list.filter((d: any) => d.diffType === diffTypeFilter);
    }
    if (diffKeyword.trim()) {
      const kw = diffKeyword.trim().toLowerCase();
      list = list.filter((d: any) =>
        d.tableName.toLowerCase().includes(kw) ||
        (d.columnName && d.columnName.toLowerCase().includes(kw)) ||
        d.diffType.toLowerCase().includes(kw) ||
        (d.message && d.message.toLowerCase().includes(kw))
      );
    }
    return list;
  })();

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
              <h1 className="text-sm font-bold text-slate-100">M13 数据模型前置管理</h1>
              <p className="text-[10px] text-slate-400">
                导入 ERMaster / PowerDesigner 设计模型 → 版本管理与对比 → 与实际 ODS 库对比 → 评估下游影响
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
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <FileUp className="w-4 h-4 text-indigo-400" />
                <span>导入设计模型</span>
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
                  <label className="block text-slate-400 mb-1">模型文件（ERMaster .erm / PowerDesigner .pdm）</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".erm,.xml,.pdm"
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
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>已导入模型 ({models.length})</span>
              </h2>

              {maintainMsg && (
                <div className={`p-2.5 rounded-lg text-[11px] ${
                  maintainMsg.includes('失败')
                    ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                    : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                }`}>
                  {maintainMsg}
                </div>
              )}

              {models.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  暂无数据模型，请从左侧导入 .erm / .pdm 模型文件
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
                          <span className="text-xs font-semibold text-slate-100">{m.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            {m.version}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                            m.status === 'BASELINE'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : m.status === 'ARCHIVED'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {m.status}
                          </span>
                          <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => openEditModal(m)}
                              title="编辑模型元数据"
                              className="p-1 rounded text-slate-500 hover:text-indigo-300 hover:bg-slate-800 transition"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteModel(m)}
                              disabled={deleting}
                              title="删除模型（连带表结构与版本历史）"
                              className="p-1 rounded text-slate-500 hover:text-rose-300 hover:bg-slate-800 disabled:opacity-50 transition"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
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

            {/* Version management: import history, version compare and diff export */}
            {selectedModel && (
              <div
                className="lg:col-span-2 p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4"
                data-testid="m13-version-panel"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-400" />
                    <span>版本管理 — {selectedModel.name}（{versions.length} 个版本）</span>
                  </h2>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-slate-500">当前版本</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">{selectedModel.version}</span>
                    {selectedModel.sourceFormat && (
                      <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30 font-mono">
                        {selectedModel.sourceFormat}
                      </span>
                    )}
                  </div>
                </div>

                {versions.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    暂无版本记录 — 重新导入该模型即可生成版本快照（同名重复导入自动升版）
                  </div>
                ) : (
                  <>
                    {/* Version chain */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {versions.map(v => (
                        <button
                          key={v.id}
                          onClick={() => setVersionTo(v.versionNo)}
                          title={`${v.tableCount} 表 / ${v.columnCount} 字段${v.importedBy ? ' · ' + v.importedBy : ''}`}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition ${
                            versionTo === v.versionNo
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {v.versionLabel || `v${v.versionNo}`}
                          <span className="ml-1.5 text-slate-500">{v.tableCount}表/{v.columnCount}字段</span>
                        </button>
                      ))}
                    </div>

                    {/* Compare controls */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-slate-400">基准版本</span>
                      <select
                        value={versionFrom === null ? '' : String(versionFrom)}
                        onChange={e => setVersionFrom(e.target.value === '' ? null : Number(e.target.value))}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="0">空基线</option>
                        {versions.map(v => (
                          <option key={v.id} value={v.versionNo}>{v.versionLabel || `v${v.versionNo}`}</option>
                        ))}
                      </select>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-400">对比版本</span>
                      <select
                        value={versionTo === null ? '' : String(versionTo)}
                        onChange={e => setVersionTo(e.target.value === '' ? null : Number(e.target.value))}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        {versions.map(v => (
                          <option key={v.id} value={v.versionNo}>{v.versionLabel || `v${v.versionNo}`}</option>
                        ))}
                      </select>
                      <button
                        onClick={runVersionDiff}
                        disabled={versionDiffLoading || versionTo === null}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-1.5"
                      >
                        {versionDiffLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
                        <span>{versionDiffLoading ? '对比中...' : '版本对比'}</span>
                      </button>
                      <button
                        onClick={() => handleExportDiff('markdown')}
                        disabled={exporting || versionTo === null}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
                      >
                        {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        <span>导出 Markdown</span>
                      </button>
                      <button
                        onClick={() => handleExportDiff('csv')}
                        disabled={exporting || versionTo === null}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>导出 CSV</span>
                      </button>
                    </div>

                    {/* Compare result */}
                    {versionDiff && (
                      <div className="space-y-3" data-testid="m13-version-diff-result">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          {[
                            { label: '表新增', value: versionDiff.summary?.tablesAdded ?? 0, cls: 'text-emerald-400' },
                            { label: '表删除', value: versionDiff.summary?.tablesRemoved ?? 0, cls: 'text-rose-400' },
                            { label: '字段新增', value: versionDiff.summary?.columnsAdded ?? 0, cls: 'text-emerald-400' },
                            { label: '字段删除', value: versionDiff.summary?.columnsRemoved ?? 0, cls: 'text-rose-400' },
                            { label: '字段变更', value: versionDiff.summary?.columnsChanged ?? 0, cls: 'text-amber-400' },
                          ].map(item => (
                            <div key={item.label} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-center">
                              <div className={`text-lg font-bold font-mono ${item.cls}`}>{item.value}</div>
                              <div className="text-[10px] text-slate-400">{item.label}</div>
                            </div>
                          ))}
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-slate-800">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60">
                                <th className="px-3 py-2 text-left font-medium">差异类型</th>
                                <th className="px-3 py-2 text-left font-medium">表</th>
                                <th className="px-3 py-2 text-left font-medium">字段</th>
                                <th className="px-3 py-2 text-left font-medium">原值</th>
                                <th className="px-3 py-2 text-left font-medium">新值</th>
                              </tr>
                            </thead>
                            <tbody>
                              {versionDiffRows.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                                    两个版本之间无结构差异
                                  </td>
                                </tr>
                              ) : (
                                versionDiffRows.map((r, i) => (
                                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                    <td className={`px-3 py-2 font-medium ${r.cls}`}>{r.type}</td>
                                    <td className="px-3 py-2 font-mono text-slate-100">{r.table}</td>
                                    <td className="px-3 py-2 font-mono text-slate-300">{r.column}</td>
                                    <td className="px-3 py-2 font-mono text-slate-400">{r.from}</td>
                                    <td className="px-3 py-2 font-mono text-slate-400">{r.to}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="text-[10px] text-slate-500">
                          对比范围: {versionDiff.fromVersion?.versionLabel || '空基线'} → {versionDiff.toVersion?.versionLabel}
                          （合计 {versionDiff.summary?.total ?? 0} 项差异）
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
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
                    <div className="text-lg font-bold text-slate-100 font-mono">{diffReport.totalDifferences}</div>
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
                  <div className="px-4 py-3 border-b border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                        <GitCompare className="w-4 h-4 text-violet-400" />
                        <span>差异明细 — {diffReport.modelName} vs {diffReport.dataSourceName} ({diffReport.targetLayer})</span>
                      </h3>
                      <span className="text-[10px] text-slate-500 font-mono">{diffReport.comparedAt}</span>
                    </div>

                    {/* Search & filter bar */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative flex-1 min-w-[200px]">
                        <input
                          type="text"
                          value={diffKeyword}
                          onChange={e => setDiffKeyword(e.target.value)}
                          placeholder="搜索表名、字段名、差异类型或说明..."
                          className="w-full px-3 py-1.5 pl-8 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        />
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {diffKeyword && (
                          <button
                            onClick={() => setDiffKeyword('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Type filter chips */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={() => setDiffTypeFilter(null)}
                          className={`px-2 py-1 rounded-md text-[10px] font-medium transition ${
                            !diffTypeFilter ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          全部 ({diffReport.differences.length})
                        </button>
                        {[
                          { key: 'MISSING_IN_ODS', label: '表缺失' },
                          { key: 'EXTRA_IN_ODS', label: '表多余' },
                          { key: 'COLUMN_MISSING', label: '字段缺失' },
                          { key: 'COLUMN_EXTRA_IN_ODS', label: '字段多余' },
                          { key: 'COLUMN_TYPE_MISMATCH', label: '类型不一致' },
                          { key: 'COLUMN_NULLABILITY_MISMATCH', label: '可空性不一致' },
                        ].map(f => {
                          const count = diffReport.differences.filter((d: any) => d.diffType === f.key).length;
                          if (count === 0) return null;
                          return (
                            <button
                              key={f.key}
                              onClick={() => setDiffTypeFilter(diffTypeFilter === f.key ? null : f.key)}
                              className={`px-2 py-1 rounded-md text-[10px] font-medium transition ${
                                diffTypeFilter === f.key ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {f.label} ({count})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Filter result hint */}
                    {(diffKeyword || diffTypeFilter) && (
                      <div className="text-[10px] text-slate-500">
                        筛选结果: {filteredDifferences.length} / {diffReport.differences.length} 条
                        {diffKeyword && <span className="ml-2">关键字: "{diffKeyword}"</span>}
                        {diffTypeFilter && <span className="ml-2">类型: {diffTypeFilter}</span>}
                      </div>
                    )}
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
                        {filteredDifferences.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-xs">
                              无匹配的差异项，请调整搜索关键字或筛选条件
                            </td>
                          </tr>
                        ) : (
                          filteredDifferences.map((d: any, i: number) => {
                            const badge = diffTypeBadge(d.diffType);
                            return (
                              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                <td className="px-4 py-2 font-mono text-slate-100">{d.tableName}</td>
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
                          })
                        )}
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
                      <div className="text-2xl font-bold text-slate-100 font-mono">{count as number}</div>
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
                              <span className="text-xs font-semibold text-slate-100 font-mono">{d.tableName}</span>
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

      {/* Model maintenance modal: rename / re-target layer, datasource / status */}
      {editingModel && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { if (!saving) setEditingModel(null); }}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4"
            onClick={e => e.stopPropagation()}
            data-testid="m13-edit-modal"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                <span>维护模型 — {editingModel.name}</span>
              </h3>
              <button
                onClick={() => setEditingModel(null)}
                disabled={saving}
                className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">模型名称</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">目标分层</label>
                  <select
                    value={editForm.targetLayer}
                    onChange={e => setEditForm(f => ({ ...f, targetLayer: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {['ODS', 'DWD', 'DWS', 'ADS', 'APP'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">状态</label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="DRAFT">DRAFT（草稿）</option>
                    <option value="BASELINE">BASELINE（基线）</option>
                    <option value="ARCHIVED">ARCHIVED（归档）</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">对比数据源</label>
                <select
                  value={editForm.targetDataSourceId}
                  onChange={e => setEditForm(f => ({ ...f, targetDataSourceId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">不绑定</option>
                  {dataSources.map(ds => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </select>
              </div>

              {editError && (
                <div className="p-2.5 rounded-lg text-[11px] bg-rose-500/10 border border-rose-500/30 text-rose-300">
                  {editError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingModel(null)}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold transition"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-1.5"
              >
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{saving ? '保存中...' : '保存'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
