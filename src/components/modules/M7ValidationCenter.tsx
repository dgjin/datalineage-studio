import React, { useEffect, useState } from 'react';
import { ValidationRule, QualityIssue, Asset } from '../../types/lineage';
import { ruleApi } from '../../services/api';
import { 
  ShieldAlert, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  FileCode, 
  ListFilter, 
  Plus, 
  Tag, 
  Clock, 
  Check, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface DryRunViolation {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  severity: string;
  message: string;
}

interface DryRunResult {
  assetId: string;
  assetName: string;
  rulesExecuted: number;
  violationCount: number;
  durationMs: number;
  violations: DryRunViolation[];
}

interface M7ValidationCenterProps {
  rules: ValidationRule[];
  issues: QualityIssue[];
  assets: Asset[];
  onSelectAsset: (assetId: string) => void;
  onRefreshRules?: () => void;
}

export const M7ValidationCenter: React.FC<M7ValidationCenterProps> = ({
  rules,
  issues,
  assets,
  onSelectAsset,
  onRefreshRules
}) => {
  const [activeTab, setActiveTab] = useState<'RULES' | 'ISSUES'>('RULES');
  const [selectedRuleId, setSelectedRuleId] = useState<string>(rules[0]?.id || '');
  const [dryRunTargetId, setDryRunTargetId] = useState<string>(assets[0]?.id || '');
  const [isRunningDryRun, setIsRunningDryRun] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const selectedRule = rules.find(r => r.id === selectedRuleId) || rules[0];

  // Keep selections valid when datasets swap between mock and real data
  useEffect(() => {
    if (rules.length === 0) return;
    if (!rules.some(r => r.id === selectedRuleId)) setSelectedRuleId(rules[0].id);
  }, [rules, selectedRuleId]);

  useEffect(() => {
    if (assets.length === 0) return;
    if (!assets.some(a => a.id === dryRunTargetId)) setDryRunTargetId(assets[0].id);
  }, [assets, dryRunTargetId]);

  // Dry run: execute all enabled rules against the selected asset via the backend
  const handleTriggerDryRun = async () => {
    const targetId = dryRunTargetId || assets[0]?.id;
    if (!targetId) return;
    setIsRunningDryRun(true);
    setDryRunError(null);
    const startedAt = performance.now();
    try {
      const res = await ruleApi.execute(targetId);
      setDryRunResult({
        assetId: res.assetId ?? targetId,
        assetName: res.assetName ?? targetId,
        rulesExecuted: res.rulesExecuted ?? 0,
        violationCount: res.violationCount ?? 0,
        durationMs: Math.round(performance.now() - startedAt),
        violations: res.violations ?? [],
      });
      onRefreshRules?.();
    } catch (e: any) {
      setDryRunResult(null);
      setDryRunError(e?.message || '校验执行失败：后端服务不可用');
    } finally {
      setIsRunningDryRun(false);
    }
  };

  // Enable/disable a rule through the backend, then refresh the shared rule list
  const handleToggleRule = async (rule: ValidationRule) => {
    setToggleError(null);
    try {
      await ruleApi.toggle(rule.id);
      onRefreshRules?.();
    } catch (e: any) {
      setToggleError(e?.message || '规则状态同步失败（后端不可用）');
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950">
      {/* Left List of Rules / Issues */}
      <div className="w-80 sm:w-96 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <span>M7 校验中心与规则引擎</span>
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              VR-001~015
            </span>
          </div>

          {/* Sub tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('RULES')}
              className={`flex-1 py-1 rounded-md font-medium transition ${
                activeTab === 'RULES' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              内置规则库 ({rules.length})
            </button>
            <button
              onClick={() => setActiveTab('ISSUES')}
              className={`flex-1 py-1 rounded-md font-medium transition ${
                activeTab === 'ISSUES' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              质量问题台账 ({issues.length})
            </button>
          </div>
        </div>

        {/* List items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
          {activeTab === 'RULES' ? (
            rules.map(rule => {
              const isSelected = selectedRuleId === rule.id;
              return (
                <div
                  key={rule.id}
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={`p-3.5 cursor-pointer transition text-xs space-y-1.5 ${
                    isSelected ? 'bg-amber-950/30 border-l-4 border-amber-500' : 'hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-amber-400">{rule.code}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        rule.severity === 'P0' 
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {rule.severity}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {rule.hitCount > 0 ? `${rule.hitCount} 处命中` : '通过'}
                      </span>
                    </div>
                  </div>

                  <div className="font-semibold text-slate-200 text-xs">{rule.name}</div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{rule.description}</p>
                </div>
              );
            })
          ) : (
            issues.map(iss => (
              <div
                key={iss.id}
                onClick={() => onSelectAsset(iss.affectedAssetId)}
                className="p-3.5 cursor-pointer hover:bg-slate-900/60 transition text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-rose-400">{iss.code}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">
                    {iss.priority}
                  </span>
                </div>
                <div className="font-semibold text-slate-200 text-xs">{iss.title}</div>
                <div className="text-[10px] text-slate-400">
                  关联资产: <span className="text-indigo-400 font-mono">{iss.affectedAssetName}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Rule Detail & Dry-Run Sandbox */}
      {selectedRule && activeTab === 'RULES' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-amber-400 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                  {selectedRule.code}
                </span>
                <h2 className="text-base font-bold text-slate-100">{selectedRule.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {selectedRule.category}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                作用域: <strong className="text-slate-300">{selectedRule.scope}</strong> ｜ 
                等级: <strong className="text-rose-400">{selectedRule.severity} (阻断级)</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={dryRunTargetId}
                onChange={(e) => setDryRunTargetId(e.target.value)}
                className="px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60 max-w-[200px]"
                title="选择 Dry Run 目标资产"
              >
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button
                onClick={handleTriggerDryRun}
                disabled={isRunningDryRun}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs transition shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{isRunningDryRun ? '正在执行校验...' : '执行校验 (Dry Run)'}</span>
              </button>
            </div>
          </div>

          {/* DSL Code Display */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-400" />
                <span>声明式校验 DSL 规则定义</span>
              </span>
              <div className="flex items-center gap-2">
                {toggleError && (
                  <span className="text-[10px] text-rose-400 font-mono">{toggleError}</span>
                )}
                <button
                  onClick={() => handleToggleRule(selectedRule)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border font-mono transition ${
                    selectedRule.enabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  }`}
                  title="点击启用/停用该规则（同步后端）"
                >
                  {selectedRule.enabled ? '● 已启用 (Enabled)' : '○ 已停用 (Disabled)'}
                </button>
              </div>
            </div>
            <pre className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-amber-200/90 overflow-x-auto border border-slate-800 leading-relaxed">
              {selectedRule.expression}
            </pre>
          </div>

          {/* Fix Hint & Guidance */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              修复指引与治理建议 (Fix Hint)
            </h4>
            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 leading-relaxed">
              {selectedRule.fixHint}
            </p>
          </div>

          {/* Dry-Run Sandbox Results */}
          {dryRunError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{dryRunError}</span>
            </div>
          )}

          {dryRunResult && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>试运行检测报告 (Dry-Run Preview)</span>
                </h4>
                <span className="text-xs text-emerald-400 font-mono">
                  耗时 {dryRunResult.durationMs}ms
                </span>
              </div>

              <div className="text-[11px] text-slate-400">
                目标资产 <strong className="text-indigo-400 font-mono">{dryRunResult.assetName}</strong>
                ｜ 执行 {dryRunResult.rulesExecuted} 条启用规则
                ｜ 命中 <strong className={dryRunResult.violationCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>{dryRunResult.violationCount}</strong> 条违规
              </div>

              {dryRunResult.violations.length > 0 ? (
                <div className="space-y-2">
                  {dryRunResult.violations.map((v, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-rose-500/30 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-rose-300 font-bold">{v.ruleCode}</span>
                          <span className="text-slate-400 text-[10px]">{v.ruleName}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">{v.severity}</span>
                        </div>
                        <div className="text-slate-300 text-[11px] mt-1">{v.message}</div>
                      </div>
                      <button
                        onClick={() => onSelectAsset(dryRunResult.assetId)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 shrink-0"
                      >
                        <span>查看资产</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>干跑通过！该资产存量元数据均符合已启用规则要求。</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Issues View */}
      {activeTab === 'ISSUES' && (
        <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-100">质量问题闭环台账 (Quality Issues Ledger)</h2>
            <p className="text-xs text-slate-400 mt-0.5">承接核对报告 35 项问题，已全部完成资产 ID 强绑定，杜绝断链</p>
          </div>

          <div className="space-y-3">
            {issues.map(iss => (
              <div key={iss.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-rose-400">{iss.code}</span>
                    <span className="font-semibold text-slate-100 text-sm">{iss.title}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                    {iss.status}
                  </span>
                </div>
                <p className="text-slate-300 text-xs">{iss.description}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                  <span>责任部门: {iss.ownerDept}</span>
                  <span>关联资产: <button onClick={() => onSelectAsset(iss.affectedAssetId)} className="text-indigo-400 hover:underline font-mono">{iss.affectedAssetName}</button></span>
                  <span>承诺完成时间: {iss.dueDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
