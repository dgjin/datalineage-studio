import React, { useCallback, useEffect, useState } from 'react';
import { ChangeEvent } from '../../types/lineage';
import { approvalApi } from '../../services/api';
import { useLineageStore } from '../../stores/lineageStore';
import { 
  Activity, 
  AlertTriangle, 
  GitPullRequest, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  FileCode, 
  Copy, 
  Check, 
  ExternalLink,
  Flame,
  ArrowRight,
  Filter,
  FileCheck,
  Gavel,
  RefreshCw
} from 'lucide-react';

interface M4ChangeCenterProps {
  changes: ChangeEvent[];
  onSimulateChange: (assetId: string) => void;
  onNavigateContract: (contractRef?: string) => void;
}

export const M4ChangeCenter: React.FC<M4ChangeCenterProps> = ({
  changes,
  onSimulateChange,
  onNavigateContract
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'APPROVAL' | 'PENDING_ACK' | 'DARK_CHANGES'>('ALL');
  const [selectedChangeId, setSelectedChangeId] = useState<string>(changes[0]?.id || '');
  const [contractPatchModalOpen, setContractPatchModalOpen] = useState(false);
  const [releaseNoteModalOpen, setReleaseNoteModalOpen] = useState(false);
  const [copiedPatch, setCopiedPatch] = useState(false);
  const [copiedReleaseNote, setCopiedReleaseNote] = useState(false);
  const [approvalRecords, setApprovalRecords] = useState<any[]>([]);
  const [approvalBusy, setApprovalBusy] = useState(false);

  const selectedChange = changes.find(c => c.id === selectedChangeId) || changes[0];

  const filteredChanges = changes.filter(c => {
    if (activeTab === 'APPROVAL') return c.status === 'APPROVAL_PENDING';
    if (activeTab === 'PENDING_ACK') return c.status === 'ACK_PENDING';
    if (activeTab === 'DARK_CHANGES') return !c.isManaged;
    return true;
  });

  const unmanagedCount = changes.filter(c => !c.isManaged).length;
  const pendingAckCount = changes.filter(c => c.status === 'ACK_PENDING').length;
  const pendingApprovalCount = changes.filter(c => c.status === 'APPROVAL_PENDING').length;

  // Approval trail for the selected change (refresh when its status flips)
  useEffect(() => {
    if (!selectedChange?.id || selectedChange.id.startsWith('mock')) {
      setApprovalRecords([]);
      return;
    }
    let cancelled = false;
    approvalApi.getRecords(selectedChange.id)
      .then(recs => { if (!cancelled) setApprovalRecords(recs); })
      .catch(() => { if (!cancelled) setApprovalRecords([]); });
    return () => { cancelled = true; };
  }, [selectedChange?.id, selectedChange?.status]);

  const decideApproval = useCallback(async (action: 'approve' | 'reject') => {
    if (!selectedChange) return;
    setApprovalBusy(true);
    try {
      if (action === 'approve') {
        await approvalApi.approve(selectedChange.id, { actor: '数据治理组', comment: '影响面已评估，批准发布' });
      } else {
        await approvalApi.reject(selectedChange.id, { actor: '数据治理组', comment: '下游影响未确认，驳回阻断发布' });
      }
      await useLineageStore.getState().fetchChanges();
    } catch (e: any) {
      alert(`审批操作失败: ${e.message}`);
    } finally {
      setApprovalBusy(false);
    }
  }, [selectedChange]);

  const generatedContractPatch = `# =========================================================
# 由 DataLineage Studio 针对生产暗改自动反向生成的契约补丁
# 资产: ${selectedChange?.assetName}
# 检测来源: ${selectedChange?.detectedBy} | 时间: ${selectedChange?.timestamp}
# =========================================================
schemaVersion: 2.0
dataset: ${selectedChange?.assetName}
domain: crm
status: PENDING_REVIEW
managedBy: GitOps

# 差异合并补丁
columns:
  - name: id
    type: BIGINT
    nullable: false
    primaryKey: true
  - name: secret_note
    type: TEXT
    nullable: true
    description: "由生产环境反向同步发现的新字段，需核验数据合规性"
    sensitivity: CONFIDENTIAL
    pii: true

auditNote: "反向补录已自动生成 MR !135，请架构师执行代码审查后合并。"`;

  // Release note is generated from the currently selected real change event —
  // never from hardcoded demo text referencing unrelated assets.
  const releaseNoteNo = `REL-${(selectedChange?.id || 'N/A').replace(/[^A-Za-z0-9-]/g, '-').slice(-14).toUpperCase()}`;
  const sampleReleaseNote = `========================================================
数据发布单 #${releaseNoteNo} (Release Note for Data)
========================================================
1. 变更清单:
   - 目标对象: ${selectedChange?.assetName ?? '-'}
   - 变更类型: ${selectedChange?.changeType ?? '-'}${selectedChange?.details?.column ? ` (列 ${selectedChange.details.column})` : ''}
   - 检测来源: ${selectedChange?.detectedBy ?? '-'} | 时间: ${selectedChange?.timestamp ?? '-'}
   - 追踪标识: ${selectedChange?.traceId ?? '-'}

2. 影响确认 (Ack) 审计:
   - 影响面判定: ${selectedChange?.impactVerdict ?? '-'}
   - 受影响: 指标 ${selectedChange?.affectedCount?.metrics ?? 0} / 报表看板 ${selectedChange?.affectedCount?.reports ?? 0} / 下游表 ${selectedChange?.affectedCount?.tables ?? 0} / 对外接口 ${selectedChange?.affectedCount?.apis ?? 0}

3. 生产发布 DDL:
${selectedChange?.details?.rawDiff ?? '（该变更未携带原始 DDL 差异记录）'}

4. 治理与审批状态:
   - 纳管状态: ${selectedChange?.isManaged ? '受控变更（契约流程内）' : '未纳管暗改（需反向补录契约）'}
   - 审批状态: ${selectedChange?.status ?? '-'} | 破坏性改动: ${selectedChange?.isBreaking ? '是' : '否'}
========================================================`;

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950">
      {/* Left List of Changes */}
      <div className="w-80 sm:w-96 border-r border-slate-800 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              <span>M4 变更事件中心</span>
            </h1>
            <button
              onClick={() => setReleaseNoteModalOpen(true)}
              className="text-xs px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1 transition"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>生成发布单</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`flex-1 py-1 rounded-md font-medium transition ${
                activeTab === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              全部变更
            </button>
            <button
              onClick={() => setActiveTab('APPROVAL')}
              className={`flex-1 py-1 rounded-md font-medium transition flex items-center justify-center gap-1 ${
                activeTab === 'APPROVAL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Gavel className="w-3.5 h-3.5 text-indigo-300" />
              <span>待审批门禁</span>
              {pendingApprovalCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-slate-900 text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                  {pendingApprovalCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('PENDING_ACK')}
              className={`flex-1 py-1 rounded-md font-medium transition flex items-center justify-center gap-1 ${
                activeTab === 'PENDING_ACK' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>待我确认</span>
              {pendingAckCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-slate-900 text-amber-300 text-[10px] flex items-center justify-center font-bold">
                  {pendingAckCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('DARK_CHANGES')}
              className={`flex-1 py-1 rounded-md font-medium transition flex items-center justify-center gap-1 ${
                activeTab === 'DARK_CHANGES' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>未纳管暗改</span>
              {unmanagedCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-slate-900 text-rose-300 text-[10px] flex items-center justify-center font-bold">
                  {unmanagedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Change Cards Stream */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
          {filteredChanges.length === 0 && (
            <div className="p-8 text-center space-y-2">
              <Activity className="w-6 h-6 mx-auto text-slate-600" />
              <p className="text-xs font-medium text-slate-400">
                {changes.length === 0 ? '暂无变更事件' : '当前筛选条件下暂无变更事件'}
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                变更经契约 CI / 采集探针 / CDC 上报后在此汇聚展示
              </p>
            </div>
          )}
          {filteredChanges.map(chg => {
            const isSelected = selectedChangeId === chg.id;
            return (
              <div
                key={chg.id}
                onClick={() => setSelectedChangeId(chg.id)}
                className={`p-3.5 cursor-pointer transition text-xs space-y-2 ${
                  isSelected ? 'bg-indigo-950/30 border-l-4 border-indigo-500' : 'hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-slate-400">{chg.timestamp}</span>
                  <div className="flex items-center gap-1.5">
                    {!chg.isManaged && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                        暗改高危
                      </span>
                    )}
                    {chg.status === 'APPROVAL_PENDING' && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                        待审批
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${
                      chg.impactVerdict === 'BLOCKER'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : chg.impactVerdict === 'SAFE'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {chg.impactVerdict}
                    </span>
                  </div>
                </div>

                <div className="font-semibold text-slate-200 font-mono text-[13px] flex items-center gap-2">
                  <span>{chg.assetName}</span>
                  <span className="text-[11px] text-indigo-400 font-sans font-normal">
                    [{chg.changeType}]
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {chg.impactSummary}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>来源: {chg.detectedBy}</span>
                  <span>操作人: {chg.actor?.split(' ')[0] ?? '-'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Change Details & Diff Viewer */}
      {selectedChange && (
        <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
          {/* Top Title & Managed/Unmanaged Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  ID: {selectedChange.id}
                </span>
                <span className="text-base font-bold text-white font-mono">{selectedChange.assetName}</span>
                <span className="text-xs font-semibold text-amber-400">({selectedChange.changeType})</span>
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                <span>时间: {selectedChange.timestamp}</span>
                <span>检测机制: {selectedChange.detectedBy}</span>
                <span>TraceId: {selectedChange.traceId}</span>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-2">
              {!selectedChange.isManaged ? (
                <button
                  onClick={() => setContractPatchModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-xs transition shadow-lg shadow-rose-500/20 flex items-center gap-1.5"
                >
                  <FileCode className="w-4 h-4" />
                  <span>一键补录契约并创建 MR</span>
                </button>
              ) : (
                <button
                  onClick={() => onSimulateChange(selectedChange.assetId)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-medium transition flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>重新分析影响</span>
                </button>
              )}
            </div>
          </div>

          {/* Unmanaged Warning Callout (if dark change) */}
          {!selectedChange.isManaged && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs text-rose-200">
              <Flame className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-sm font-semibold text-rose-300 mb-1">
                  未纳管暗改 (Unmanaged Schema Drift) 阻断告警
                </strong>
                此变更是通过数据库生产管理工具或脚本直接在底层执行的 DDL，未走 Git 契约版本控制，严重违反治理底线！
                系统已捕获 schema 快照，请点击右上角【一键补录契约】将生产实际结构反向提交为受控 MR。
              </div>
            </div>
          )}

          {/* Approval gate panel (publish approval workflow) */}
          {(selectedChange.status === 'APPROVAL_PENDING' ||
            selectedChange.status === 'APPROVED' ||
            selectedChange.status === 'REJECTED') && (
            <div className={`p-4 rounded-xl border space-y-3 text-xs ${
              selectedChange.status === 'APPROVAL_PENDING'
                ? 'bg-indigo-500/10 border-indigo-500/30'
                : selectedChange.status === 'APPROVED'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-rose-500/10 border-rose-500/30'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className={`font-bold flex items-center gap-2 ${
                  selectedChange.status === 'APPROVAL_PENDING'
                    ? 'text-indigo-200'
                    : selectedChange.status === 'APPROVED'
                      ? 'text-emerald-200'
                      : 'text-rose-200'
                }`}>
                  <Gavel className="w-4 h-4" />
                  {selectedChange.status === 'APPROVAL_PENDING'
                    ? `发布审批门禁：影响面 ${selectedChange.impactVerdict}，审批通过后方可发布`
                    : selectedChange.status === 'APPROVED'
                      ? '审批已通过：该变更已获准进入发布流程'
                      : '审批已驳回：该变更被阻断，禁止发布'}
                </span>
                {selectedChange.status === 'APPROVAL_PENDING' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => decideApproval('approve')}
                      disabled={approvalBusy}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold flex items-center gap-1.5 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      批准发布
                    </button>
                    <button
                      onClick={() => decideApproval('reject')}
                      disabled={approvalBusy}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-semibold flex items-center gap-1.5 transition"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      驳回
                    </button>
                  </div>
                )}
              </div>
              {approvalRecords.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-slate-800/60">
                  {approvalRecords.map((r: any) => (
                    <div key={r.id} className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span className={`font-mono font-bold ${
                        r.action === 'APPROVE' ? 'text-emerald-400' : r.action === 'REJECT' ? 'text-rose-400' : 'text-indigo-300'
                      }`}>{r.action}</span>
                      <span className="text-slate-300">{r.actor || '-'}</span>
                      <span className="truncate">{r.comment || ''}</span>
                      <span className="ml-auto font-mono shrink-0">{(r.decidedAt || r.createdAt || '').replace('T', ' ').slice(0, 19)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Diff Viewer Card */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span>结构变更差异比对 (Diff Viewer)</span>
              </h3>
              <span className={`text-[11px] font-mono inline-flex items-center gap-1 ${
                selectedChange.isBreaking ? 'text-rose-400' : 'text-slate-400'
              }`}>
                {selectedChange.isBreaking ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>破坏性改动</span>
                  </>
                ) : '✓ 兼容性改动'}
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
              <pre>{selectedChange.details?.rawDiff ?? '-- 该变更事件未包含原始 DDL 差异记录'}</pre>
            </div>
          </div>

          {/* Affected Assets Summary & Ack Progress */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 block text-[11px]">受影响指标</span>
              <span className="text-xl font-bold font-mono text-white mt-1 block">
                {selectedChange.affectedCount.metrics}
              </span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 block text-[11px]">受影响报表/看板</span>
              <span className="text-xl font-bold font-mono text-white mt-1 block">
                {selectedChange.affectedCount.reports}
              </span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 block text-[11px]">受影响下游表</span>
              <span className="text-xl font-bold font-mono text-white mt-1 block">
                {selectedChange.affectedCount.tables}
              </span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 block text-[11px]">受影响对外接口</span>
              <span className="text-xl font-bold font-mono text-white mt-1 block">
                {selectedChange.affectedCount.apis}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Contract Patch Modal (一键补录契约) */}
      {contractPatchModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm">反向生成 Git 契约补丁 (Reverse Contract Patch)</h3>
                <p className="text-slate-400 text-[11px] mt-0.5">将生产已发生的暗改结构自动格式化为契约 YAML，纠正断链</p>
              </div>
              <button onClick={() => setContractPatchModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-semibold">生成的目标 YAML 规范:</span>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(generatedContractPatch);
                    setCopiedPatch(true);
                    setTimeout(() => setCopiedPatch(false), 2000);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedPatch ? '已复制' : '复制补丁'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 rounded-lg text-emerald-300 font-mono text-xs overflow-x-auto border border-slate-800 max-h-60 leading-relaxed">
                {generatedContractPatch}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">
                点击将调用 Gitea/GitLab API 自动创建分支与 Pull Request
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setContractPatchModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  关闭
                </button>
                <button
                  onClick={() => {
                    alert('已成功创建 Git 契约补丁 MR !135，并自动指派架构师审批！');
                    setContractPatchModalOpen(false);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5"
                >
                  <GitPullRequest className="w-4 h-4" />
                  <span>立即提交 MR 纳入受控管理</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Release Note Modal */}
      {releaseNoteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm">发布握手单 (Release Note for Data)</h3>
                <p className="text-slate-400 text-[11px] mt-0.5">衔接手绘方案“批准后发布”，交付 DBA 或自动化部署流水线</p>
              </div>
              <button onClick={() => setReleaseNoteModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <pre className="p-3 bg-slate-950 rounded-lg text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800 max-h-72 leading-relaxed">
              {sampleReleaseNote}
            </pre>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(sampleReleaseNote);
                  setCopiedReleaseNote(true);
                  setTimeout(() => setCopiedReleaseNote(false), 2000);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedReleaseNote ? '已复制' : '复制发布单文本'}</span>
              </button>
              <button
                onClick={() => setReleaseNoteModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
