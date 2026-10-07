import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Copy,
  Check,
  Layers,
  Activity,
  RefreshCw,
  GitFork,
  BookOpen,
  Gavel,
  Users,
  ScrollText,
  X,
} from 'lucide-react';
import { dashboardApi, auditApi } from '../../services/api';

/**
 * M9 Governance Dashboard - now driven by live aggregates from
 * /dashboard/overview (asset health, standards, approvals, quality, lineage).
 */
export const M9GovernanceDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [auditData, setAuditData] = useState<{ total: number; records: any[] } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const overview = await dashboardApi.overview();
      setData(overview);
      setError(null);
    } catch (e: any) {
      setError(e?.message || '加载治理看板数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await auditApi.query({ page: 1, size: 50 });
      setAuditData(res as any);
    } catch {
      setAuditData({ total: 0, records: [] });
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auditDrawerOpen) loadAudit();
  }, [auditDrawerOpen, loadAudit]);

  const weeklyReport = useMemo(() => (data ? generateWeeklyReport(data) : ''), [data]);

  const gradeColor = (grade: string) =>
    grade === 'HEALTHY' ? 'text-emerald-400' : grade === 'ATTENTION' ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <span>M9 治理运营看板与工作汇报驾驶舱</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            实时聚合资产健康分、标准覆盖、变更审批与质量闭环，一键生成可汇报的治理周报
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>刷新</span>
          </button>
          <button
            onClick={() => setAuditDrawerOpen(true)}
            className="px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs transition flex items-center gap-2"
          >
            <ScrollText className="w-3.5 h-3.5 text-cyan-400" />
            <span>审计轨迹</span>
          </button>
          <button
            onClick={() => setReportModalOpen(true)}
            disabled={!data}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 text-white font-semibold text-xs transition shadow-lg shadow-indigo-500/20 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            <span>一键导出治理工作周报 (Markdown)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> 正在聚合治理数据...
        </div>
      ) : data ? (
        <>
          {/* 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Card 1: Asset health */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[11px]">平均资产健康分</span>
                <Layers className="w-4 h-4 text-indigo-400" />
              </div>
              <div className={`text-2xl font-bold font-mono ${gradeColor(
                data.health.avgScore >= 85 ? 'HEALTHY' : data.health.avgScore >= 60 ? 'ATTENTION' : 'RISK')}`}>
                {data.health.avgScore}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                <span>健康 <strong className="text-emerald-400">{data.health.healthy}</strong> ｜ 关注 <strong className="text-amber-400">{data.health.attention}</strong> ｜ 风险 <strong className="text-rose-400">{data.health.risk}</strong></span>
                <span>共 {data.assetTotal} 项资产</span>
              </div>
            </div>

            {/* Card 2: Change & approval */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[11px]">变更与审批门禁</span>
                <Gavel className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-400">{data.changes.pendingApproval}</div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                <span>待审批 ｜ 已批准 <strong className="text-emerald-400">{data.changes.approvalReleased}</strong></span>
                <span>破坏性 {data.changes.breaking} 项</span>
              </div>
            </div>

            {/* Card 3: Quality */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[11px]">质量违规闭环</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className={`text-2xl font-bold font-mono ${data.quality.p0Issues > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {data.quality.openIssues}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                <span>P0 严重: <strong className={data.quality.p0Issues > 0 ? 'text-rose-400' : 'text-slate-300'}>{data.quality.p0Issues}</strong></span>
                <span>启用规则 {data.quality.ruleEnabled}/{data.quality.ruleTotal}</span>
              </div>
            </div>

            {/* Card 4: Governance coverage */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[11px]">治理覆盖率</span>
                <Users className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">{data.governance.contractCoverage}%</div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                <span>契约绑定率 ｜ Owner <strong className="text-cyan-400">{data.governance.ownerCoverage}%</strong></span>
                <span>标准 {data.governance.standardPublished}/{data.governance.standardTotal}</span>
              </div>
            </div>
          </div>

          {/* Detailed Analytics Rows */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Layer distribution */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs">
              <h3 className="font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                数仓分层纳管明细 (Layer Breakdown)
              </h3>
              <div className="space-y-2.5">
                {(['ODS', 'DWD', 'DWS', 'ADS', 'APP'] as const).map((layer) => {
                  const count = data.layerDistribution[layer] || 0;
                  const layerHealth = data.assetHealthSummary?.[layer];
                  return (
                    <div key={layer} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-200 block">
                          {layer} ({LAYER_LABEL[layer]})
                        </span>
                        <span className="text-[10px] text-slate-400">{count} 个实体对象</span>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <span className="text-[10px] text-slate-400 block">占比</span>
                          <span className="font-mono font-bold text-cyan-400">
                            {data.assetTotal ? Math.round((count / data.assetTotal) * 100) : 0}%
                          </span>
                        </div>
                        {layerHealth !== undefined && (
                          <div>
                            <span className="text-[10px] text-slate-400 block">平均健康</span>
                            <span className={`font-mono font-bold ${gradeColor(layerHealth >= 85 ? 'HEALTHY' : layerHealth >= 60 ? 'ATTENTION' : 'RISK')}`}>
                              {layerHealth}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Risk assets + zombie assets */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs">
              <h3 className="font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                风险资产 TOP5（按健康分升序）
              </h3>
              <div className="space-y-2">
                {data.health.riskAssets?.length ? data.health.riskAssets.map((asset: any) => (
                  <div key={asset.assetId} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-slate-200">{asset.assetName}</span>
                      <span className={`font-mono font-bold ${gradeColor(asset.grade)}`}>{asset.score} 分</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block pt-0.5">
                      {asset.findings?.join('；') || '无风险项'}
                    </span>
                  </div>
                )) : (
                  <div className="text-slate-500 text-center py-4">暂无风险资产</div>
                )}
              </div>
              {data.zombieAssets?.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400 font-semibold">
                    疑似僵尸资产（产出层无下游消费）: {data.zombieAssets.length} 项
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {data.zombieAssets.map((z: any) => (
                      <span key={z.id} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-400">
                        {z.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Governance baseline row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Change closure baseline */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs">
              <h3 className="font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                变更闭环与暗改防范治理基线
              </h3>
              <ProgressRow
                label="变更闭环率（已解决/已批准/已驳回 ÷ 总量）"
                value={data.changes.total
                  ? Math.round(((data.changes.total - data.changes.unresolved) / data.changes.total) * 100)
                  : 100}
                color="bg-emerald-500"
                hint={`未决变更 ${data.changes.unresolved} 项，待审批 ${data.changes.pendingApproval} 项`}
              />
              <ProgressRow
                label="纳入管理率（非暗改占比）"
                value={data.changes.total
                  ? Math.round(((data.changes.total - data.changes.unmanaged) / data.changes.total) * 100)
                  : 100}
                color="bg-cyan-500"
                hint={`未纳管暗改 ${data.changes.unmanaged} 项`}
              />
              <ProgressRow
                label="高风险变更审批覆盖率"
                value={data.changes.blockerHigh
                  ? Math.round((data.changes.pendingApproval + data.changes.approvalReleased) / data.changes.blockerHigh * 100)
                  : 100}
                color="bg-indigo-500"
                hint={`BLOCKER/HIGH 变更 ${data.changes.blockerHigh} 项，均已进入审批门禁`}
              />
            </div>

            {/* Standards & lineage */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs">
              <h3 className="font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                标准中枢与血缘资产盘点
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="数据标准" value={`${data.governance.standardPublished}/${data.governance.standardTotal}`} hint="已发布/总数" />
                <MiniStat label="业务词根" value={data.governance.glossaryTotal} hint="术语与词根" />
                <MiniStat label="编码字典集" value={data.governance.codeSetTotal} hint="参考数据" />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <MiniStat label="血缘边" value={data.lineage.edgeTotal} hint="全部关系" />
                <MiniStat label="字段级边" value={data.lineage.columnEdges} hint="列级血缘" />
                <MiniStat label="表级边" value={data.lineage.tableEdges} hint="拓扑关系" />
              </div>
              <div className="pt-1">
                <span className="text-[10px] text-slate-400 font-semibold block pb-1.5">跨层数据流分布</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(data.lineage.layerFlows || {}).map(([flow, count]) => (
                    <span key={flow} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] text-cyan-300">
                      {flow} × {count as number}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top rule hits */}
          {data.quality.topRules?.length > 0 && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs">
              <h3 className="font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                规则命中 TOP{data.quality.topRules.length}（校验前移热点）
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {data.quality.topRules.map((rule: any) => (
                  <div key={rule.code} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-400">{rule.code}</span>
                      <span className={`px-1.5 rounded text-[10px] font-bold ${
                        rule.severity === 'P0' ? 'bg-rose-500/20 text-rose-300' : rule.severity === 'P1' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-300'
                      }`}>{rule.severity}</span>
                    </div>
                    <span className="text-slate-300 block pt-1 leading-snug">{rule.name}</span>
                    <span className="text-amber-400 font-mono font-bold block pt-1">命中 {rule.hitCount} 次</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer meta */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
            <span className="flex items-center gap-1">
              <GitFork className="w-3 h-3" />
              数据来源：资产/血缘/标准/变更/质量实时聚合
            </span>
            <span>生成时间: {new Date(data.generatedAt).toLocaleString('zh-CN')}</span>
          </div>
        </>
      ) : null}

      {/* Audit Trail Drawer (right slide-in, full-chain write audit) */}
      {auditDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-slate-950/60 backdrop-blur-sm" onClick={() => setAuditDrawerOpen(false)} />
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-cyan-400" />
                  <span>全链路审计轨迹</span>
                </h3>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  所有写操作（POST/PUT/DELETE）自动留痕：操作者 / 动作 / 资源 / 结果 / 耗时
                </p>
              </div>
              <button onClick={() => setAuditDrawerOpen(false)} className="text-slate-400 hover:text-slate-100 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
              <button
                onClick={loadAudit}
                disabled={auditLoading}
                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${auditLoading ? 'animate-spin' : ''}`} />
                <span>刷新</span>
              </button>
              <span className="text-slate-400 font-mono text-[11px]">
                共 {auditData?.total ?? 0} 条 · 显示最近 {auditData?.records?.length ?? 0} 条
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {auditLoading && !auditData ? (
                <div className="text-center text-slate-500 text-xs py-10">加载中…</div>
              ) : (auditData?.records?.length ?? 0) === 0 ? (
                <div className="text-center text-slate-500 text-xs py-10">
                  暂无审计记录，执行任意写操作（如触发采集/审批/发布标准）后此处自动留痕
                </div>
              ) : (
                auditData!.records.map((r: any) => (
                  <div key={r.id} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px] space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono text-[10px] shrink-0 ${
                            r.result === 'SUCCESS'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {r.result}
                        </span>
                        <span className="font-semibold text-cyan-300 font-mono shrink-0">{r.action}</span>
                        <span className="text-slate-300 shrink-0">{r.resourceType}</span>
                        {r.resourceId && (
                          <span className="text-slate-500 font-mono truncate max-w-[140px]">{r.resourceId}</span>
                        )}
                      </div>
                      <span className="font-mono text-slate-500 text-[10px] shrink-0">
                        {r.durationMs != null ? `${r.durationMs}ms` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono gap-2">
                      <span className="truncate">
                        {r.username}
                        {r.role ? ` (${r.role})` : ''} · {r.httpMethod} {r.path}
                      </span>
                      <span className="shrink-0">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false }) : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Weekly Report Modal */}
      {reportModalOpen && data && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">治理工作周报预览 (Markdown 导出)</h3>
                <p className="text-slate-400 text-[11px] mt-0.5">基于实时治理数据生成，可直接复制发往数据治理委员会与管理层汇报</p>
              </div>
              <button onClick={() => setReportModalOpen(false)} className="text-slate-400 hover:text-slate-100">✕</button>
            </div>

            <pre className="p-3.5 bg-slate-950 rounded-lg text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800 max-h-80 leading-relaxed whitespace-pre-wrap">
              {weeklyReport}
            </pre>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(weeklyReport);
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

// ---- Helpers ----

const LAYER_LABEL: Record<string, string> = {
  ODS: '源数据层',
  DWD: '规范明细层',
  DWS: '轻度汇总层',
  ADS: '应用集市层',
  APP: '报表/API/指标',
};

const ProgressRow: React.FC<{ label: string; value: number; color: string; hint?: string }> = ({
  label, value, color, hint,
}) => (
  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
    <div className="flex items-center justify-between">
      <span className="text-slate-300 font-medium">{label}</span>
      <span className="font-mono font-bold text-emerald-400">{value}%</span>
    </div>
    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
    {hint && <span className="text-[10px] text-slate-400 block pt-0.5">{hint}</span>}
  </div>
);

const MiniStat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({
  label, value, hint,
}) => (
  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
    <span className="text-[10px] text-slate-400 block">{label}</span>
    <span className="font-mono font-bold text-slate-100 text-base block pt-0.5">{value}</span>
    {hint && <span className="text-[9px] text-slate-500 block">{hint}</span>}
  </div>
);

/** Build a weekly report from the live overview payload. */
function generateWeeklyReport(d: any): string {
  const layerLine = (['ODS', 'DWD', 'DWS', 'ADS', 'APP'] as const)
    .map((l) => `${l} ${d.layerDistribution?.[l] || 0}`)
    .join(' / ');
  const lines = [
    '# 数据血缘与资产治理工作周报',
    `生成时间: ${new Date(d.generatedAt).toLocaleString('zh-CN')} ｜ 汇报部门: 数据治理组与架构委员会`,
    '',
    '## 一、资产与健康度',
    `- 纳管资产总量: ${d.assetTotal} 项（${layerLine}）`,
    `- 平均资产健康分: ${d.health?.avgScore}（健康 ${d.health?.healthy} / 关注 ${d.health?.attention} / 风险 ${d.health?.risk}）`,
    `- 责任人(Owner)覆盖率: ${d.governance?.ownerCoverage}% ｜ 契约绑定率: ${d.governance?.contractCoverage}%`,
    `- 数据标准: ${d.governance?.standardPublished}/${d.governance?.standardTotal} 项已发布 ｜ 业务词根 ${d.governance?.glossaryTotal} 项 ｜ 编码集 ${d.governance?.codeSetTotal} 个`,
    '',
    '## 二、变更与审批门禁',
    `- 变更事件总量: ${d.changes?.total} 项（破坏性 ${d.changes?.breaking} 项，其中 BLOCKER/HIGH ${d.changes?.blockerHigh} 项）`,
    `- 待审批: ${d.changes?.pendingApproval} 项 ｜ 已批准发布: ${d.changes?.approvalReleased} 项`,
    `- 未决变更: ${d.changes?.unresolved} 项 ｜ 未纳管暗改: ${d.changes?.unmanaged} 项`,
    '',
    '## 三、质量与校验闭环',
    `- 未关闭质量问题: ${d.quality?.openIssues} 项（P0 严重: ${d.quality?.p0Issues} 项）`,
    `- 校验规则启用: ${d.quality?.ruleEnabled}/${d.quality?.ruleTotal}`,
    ...(d.quality?.topRules?.length
      ? d.quality.topRules.map((r: any) => `- 热点规则 ${r.code}《${r.name}》命中 ${r.hitCount} 次 [${r.severity}]`)
      : ['- 本期无规则命中记录']),
    '',
    '## 四、血缘资产',
    `- 血缘关系边总量: ${d.lineage?.edgeTotal}（字段级 ${d.lineage?.columnEdges} / 表级 ${d.lineage?.tableEdges}）`,
    ...(d.zombieAssets?.length
      ? [`- 疑似僵尸资产: ${d.zombieAssets.length} 项（${d.zombieAssets.map((z: any) => z.name).join(', ')}）`]
      : ['- 无僵尸资产']),
  ];
  if (d.health?.riskAssets?.length) {
    lines.push('', '## 五、健康分最低资产（重点整改）');
    d.health.riskAssets.forEach((a: any) => {
      lines.push(`- ${a.assetName}（${a.score} 分，${a.grade}）: ${(a.findings || []).join('；')}`);
    });
  }
  lines.push('', `> 本报告由 DataLineage Studio 治理驾驶舱基于实时数据自动生成`);
  return lines.join('\n');
}

export default M9GovernanceDashboard;
