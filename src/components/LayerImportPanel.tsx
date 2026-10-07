import React, { useCallback, useEffect, useState } from 'react';
import { layerImportApi, datasourceApi } from '../services/api';
import {
  Layers,
  Plus,
  RefreshCw,
  Play,
  FlaskConical,
  Trash2,
  ArrowRight,
  Database,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Server,
  Link2
} from 'lucide-react';

const WAREHOUSE_LAYERS = ['ODS', 'DWD', 'DWS', 'ADS', 'APP'];

interface DataSourceOption {
  id: string;
  name: string;
}

interface LayerStatsItem {
  layer: string;
  dataSourceId: string;
  dataSourceName: string;
  assetCount: number;
}

interface RelationView {
  id: string;
  name: string;
  fromLayer: string;
  toLayer: string;
  fromDataSourceId: string;
  fromDataSourceName: string;
  toDataSourceId: string;
  toDataSourceName: string;
  matchMode: 'OBJECT_NAME' | 'ETL_SQL';
  etlSql?: string;
  status: string;
  lastBuildAt?: string;
  lastBuildResult?: string;
  edgesBuilt: number;
}

interface PlanResult {
  relationId: string;
  relationName: string;
  action: 'PREVIEW' | 'BUILD';
  edgesPlanned: number;
  edgesRemoved?: number;
  unmatched: number;
  ambiguous: number;
  unmatchedTargets: string[];
  ambiguousTargets: string[];
  edges: {
    fromName: string;
    toName: string;
    kind: string;
    fromColumn?: string;
    toColumn?: string;
    confidence: number;
  }[];
}

const emptyForm = {
  name: '',
  fromLayer: 'ODS',
  toLayer: 'DWD',
  fromDataSourceId: '',
  toDataSourceId: '',
  matchMode: 'OBJECT_NAME' as 'OBJECT_NAME' | 'ETL_SQL',
  etlSql: ''
};

/**
 * M10 embedded panel: multi-source warehouse layer import.
 * Declares ODS->DWD->DWS->ADS->APP flows between different data sources,
 * then previews / builds the cross-source lineage edges they produce.
 */
export const LayerImportPanel: React.FC = () => {
  const [layerStats, setLayerStats] = useState<LayerStatsItem[]>([]);
  const [relations, setRelations] = useState<RelationView[]>([]);
  const [crossSourceEdges, setCrossSourceEdges] = useState(0);
  const [dataSources, setDataSources] = useState<DataSourceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [stats, ds] = await Promise.all([layerImportApi.stats(), datasourceApi.list()]);
      setLayerStats(stats.layers || []);
      setRelations((stats.relations || []) as RelationView[]);
      setCrossSourceEdges(stats.crossSourceEdges || 0);
      setDataSources((ds || []).map((d: any) => ({ id: d.id, name: d.name })));
      setError(null);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.fromDataSourceId || !form.toDataSourceId) {
      setError('请填写名称并选择源/目标数据源');
      return;
    }
    try {
      await layerImportApi.create(form);
      setForm(emptyForm);
      setShowForm(false);
      setError(null);
      await loadAll();
    } catch (e: any) {
      setError(e.message || '创建失败');
    }
  };

  const runPlan = async (rel: RelationView, action: 'PREVIEW' | 'BUILD') => {
    setBusyId(rel.id);
    setError(null);
    try {
      const data = action === 'PREVIEW'
        ? await layerImportApi.preview(rel.id)
        : await layerImportApi.build(rel.id);
      setResult({ ...data, relationName: rel.name, action });
      if (action === 'BUILD') await loadAll();
    } catch (e: any) {
      setError(e.message || (action === 'PREVIEW' ? '预检失败' : '构建失败'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (rel: RelationView) => {
    if (!window.confirm(`删除关系「${rel.name}」将级联删除其生成的血缘边，确认？`)) return;
    setBusyId(rel.id);
    try {
      await layerImportApi.remove(rel.id);
      if (result?.relationId === rel.id) setResult(null);
      await loadAll();
    } catch (e: any) {
      setError(e.message || '删除失败');
    } finally {
      setBusyId(null);
    }
  };

  // (layer, dataSourceId) -> asset count, for the matrix
  const matrix = new Map<string, number>();
  const dsIds: string[] = [];
  const dsNames = new Map<string, string>();
  for (const item of layerStats) {
    if (!dsIds.includes(item.dataSourceId)) dsIds.push(item.dataSourceId);
    dsNames.set(item.dataSourceId, item.dataSourceName);
    matrix.set(`${item.layer}|${item.dataSourceId}`, item.assetCount);
  }

  const modeBadge = (mode: string) => (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
      mode === 'ETL_SQL'
        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
        : 'bg-violet-500/15 text-violet-300 border-violet-500/40'
    }`}>
      {mode === 'ETL_SQL' ? 'SQL 解析' : '同名匹配'}
    </span>
  );

  return (
    <div className="space-y-5 text-xs">
      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Layer x DataSource matrix */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <span>分层 × 数据源分布矩阵</span>
          </h3>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-slate-400">
              跨源血缘边: <span className="font-mono font-bold text-cyan-300">{crossSourceEdges}</span>
            </span>
            <button
              onClick={loadAll}
              disabled={loading}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 transition"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-left py-2 px-2 font-medium">数仓分层</th>
                {dsIds.map(id => (
                  <th key={id} className="text-left py-2 px-2 font-medium">
                    <span className="flex items-center gap-1">
                      <Database className="w-3 h-3 text-slate-500" />
                      {dsNames.get(id) || id}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WAREHOUSE_LAYERS.map(layer => (
                <tr key={layer} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 px-2">
                    <span className="font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                      {layer}
                    </span>
                  </td>
                  {dsIds.map(id => {
                    const cnt = matrix.get(`${layer}|${id}`);
                    return (
                      <td key={id} className="py-2 px-2">
                        {cnt ? (
                          <span className="font-mono text-emerald-300">{cnt} <span className="text-slate-500">个对象</span></span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          各层对象从其所在数据源独立采集导入（资产已回填归属）；跨源层间关系通过下方「导入关系」声明并构建血缘边。
        </p>
      </div>

      {/* Relations */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Link2 className="w-4 h-4 text-indigo-400" />
            <span>层间导入关系（跨数据源）</span>
          </h3>
          <button
            onClick={() => setShowForm(v => !v)}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>声明新关系</span>
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <label className="space-y-1 col-span-2">
                <span className="text-slate-400">关系名称</span>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="如: ODS(MySQL) → DWD(数仓)"
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">源层</span>
                <select
                  value={form.fromLayer}
                  onChange={e => setForm({ ...form, fromLayer: e.target.value })}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {WAREHOUSE_LAYERS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">目标层</span>
                <select
                  value={form.toLayer}
                  onChange={e => setForm({ ...form, toLayer: e.target.value })}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {WAREHOUSE_LAYERS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">源数据源</span>
                <select
                  value={form.fromDataSourceId}
                  onChange={e => setForm({ ...form, fromDataSourceId: e.target.value })}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">请选择...</option>
                  {dataSources.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">目标数据源</span>
                <select
                  value={form.toDataSourceId}
                  onChange={e => setForm({ ...form, toDataSourceId: e.target.value })}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">请选择...</option>
                  {dataSources.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">匹配模式</span>
                <select
                  value={form.matchMode}
                  onChange={e => setForm({ ...form, matchMode: e.target.value as 'OBJECT_NAME' | 'ETL_SQL' })}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="OBJECT_NAME">同名匹配（去层前缀）</option>
                  <option value="ETL_SQL">ETL SQL 解析（INSERT..SELECT）</option>
                </select>
              </label>
            </div>

            {form.matchMode === 'ETL_SQL' && (
              <label className="space-y-1 block">
                <span className="text-slate-400">ETL SQL（可多条，分号分隔；无 schema 的表名在本层内按对象名解析）</span>
                <textarea
                  value={form.etlSql}
                  onChange={e => setForm({ ...form, etlSql: e.target.value })}
                  rows={5}
                  placeholder={'INSERT INTO dwd_order_detail (order_id, customer_id)\nSELECT o.id, o.customer_id FROM ods_orders o;'}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-cyan-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </label>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setShowForm(false); setForm(emptyForm); }}
                className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
              >
                创建关系
              </button>
            </div>
          </div>
        )}

        {/* Relation list */}
        {relations.length === 0 ? (
          <div className="p-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
            尚未声明层间导入关系。点击「声明新关系」指定 ODS/DWD/DWS/ADS/APP 各层所在的数据源，建立跨源血缘。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-left py-2 px-2 font-medium">名称</th>
                  <th className="text-left py-2 px-2 font-medium">层间流向</th>
                  <th className="text-left py-2 px-2 font-medium">源 → 目标</th>
                  <th className="text-left py-2 px-2 font-medium">模式</th>
                  <th className="text-left py-2 px-2 font-medium">状态</th>
                  <th className="text-right py-2 px-2 font-medium">已建边</th>
                  <th className="text-left py-2 px-2 font-medium">上次构建</th>
                  <th className="text-right py-2 px-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {relations.map(rel => (
                  <tr key={rel.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-950/50">
                    <td className="py-2 px-2 text-slate-200 font-medium">{rel.name}</td>
                    <td className="py-2 px-2">
                      <span className="flex items-center gap-1 font-mono">
                        <span className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700">{rel.fromLayer}</span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        <span className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700">{rel.toLayer}</span>
                      </span>
                    </td>
                    <td className="py-2 px-2 text-slate-400">
                      {rel.fromDataSourceName} <ArrowRight className="w-3 h-3 inline text-slate-600" /> {rel.toDataSourceName}
                    </td>
                    <td className="py-2 px-2">{modeBadge(rel.matchMode)}</td>
                    <td className="py-2 px-2">
                      <span className={`font-mono px-1.5 py-0.5 rounded border ${
                        rel.status === 'ACTIVE'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-700/40 text-slate-300 border-slate-600'
                      }`}>
                        {rel.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-200">{rel.edgesBuilt}</td>
                    <td className="py-2 px-2 text-slate-500 font-mono text-[10px]">
                      {rel.lastBuildAt ? String(rel.lastBuildAt).replace('T', ' ').slice(0, 19) : '-'}
                      {rel.lastBuildResult && (
                        <div className="text-slate-600">{rel.lastBuildResult}</div>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => runPlan(rel, 'PREVIEW')}
                          disabled={busyId === rel.id}
                          title="预检（dry-run，不落库）"
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 transition disabled:opacity-50"
                        >
                          <FlaskConical className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => runPlan(rel, 'BUILD')}
                          disabled={busyId === rel.id}
                          title="构建（幂等重建血缘边）"
                          className="p-1.5 rounded bg-indigo-600/80 hover:bg-indigo-500 text-white transition disabled:opacity-50"
                        >
                          {busyId === rel.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDelete(rel)}
                          disabled={busyId === rel.id}
                          title="删除关系（级联删除其血缘边）"
                          className="p-1.5 rounded bg-slate-800 hover:bg-rose-950 text-rose-400 transition disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plan result */}
      {result && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              {result.action === 'PREVIEW'
                ? <FlaskConical className="w-4 h-4 text-cyan-400" />
                : <GitBranch className="w-4 h-4 text-emerald-400" />}
              <span>
                {result.action === 'PREVIEW' ? '预检结果' : '构建结果'} — {result.relationName}
              </span>
            </h3>
            <button onClick={() => setResult(null)} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[10px]">计划边数</div>
              <div className="font-mono font-bold text-slate-100 text-base">{result.edgesPlanned}</div>
            </div>
            {result.action === 'BUILD' && (
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-slate-400 text-[10px]">重建移除</div>
                <div className="font-mono font-bold text-amber-300 text-base">{result.edgesRemoved ?? 0}</div>
              </div>
            )}
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[10px]">未匹配（盒外）</div>
              <div className={`font-mono font-bold text-base ${result.unmatched > 0 ? 'text-amber-300' : 'text-slate-500'}`}>
                {result.unmatched}
              </div>
            </div>
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[10px]">歧义</div>
              <div className={`font-mono font-bold text-base ${result.ambiguous > 0 ? 'text-rose-300' : 'text-slate-500'}`}>
                {result.ambiguous}
              </div>
            </div>
          </div>

          {(result.unmatchedTargets?.length > 0 || result.ambiguousTargets?.length > 0) && (
            <div className="space-y-1">
              {result.ambiguousTargets?.map((t, i) => (
                <div key={`a${i}`} className="flex items-center gap-1.5 text-rose-300">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span className="font-mono">{t}</span>
                </div>
              ))}
              {result.unmatchedTargets?.map((t, i) => (
                <div key={`u${i}`} className="flex items-center gap-1.5 text-amber-300/90">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span className="font-mono">{t}</span>
                </div>
              ))}
            </div>
          )}

          {result.edges.length > 0 && (
            <div className="max-h-72 overflow-y-auto border border-slate-800 rounded-lg">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-slate-950">
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="text-left py-1.5 px-2 font-medium">类型</th>
                    <th className="text-left py-1.5 px-2 font-medium">上游</th>
                    <th className="text-left py-1.5 px-2 font-medium">下游</th>
                    <th className="text-right py-1.5 px-2 font-medium">置信度</th>
                  </tr>
                </thead>
                <tbody>
                  {result.edges.map((e, i) => (
                    <tr key={i} className="border-b border-slate-800/60 last:border-0">
                      <td className="py-1.5 px-2">
                        <span className={`font-mono text-[10px] px-1 py-0.5 rounded ${
                          e.kind === 'COLUMN' ? 'bg-sky-500/15 text-sky-300' : 'bg-indigo-500/15 text-indigo-300'
                        }`}>
                          {e.kind}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-slate-300 font-mono">
                        {e.fromName}
                        {e.fromColumn && <span className="text-sky-300">.{e.fromColumn}</span>}
                      </td>
                      <td className="py-1.5 px-2 text-slate-300 font-mono">
                        {e.toName}
                        {e.toColumn && <span className="text-sky-300">.{e.toColumn}</span>}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-400">{e.confidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
