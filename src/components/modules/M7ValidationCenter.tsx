import React, { useState } from 'react';
import { ValidationRule, QualityIssue } from '../../types/lineage';
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

interface M7ValidationCenterProps {
  rules: ValidationRule[];
  issues: QualityIssue[];
  onSelectAsset: (assetId: string) => void;
}

export const M7ValidationCenter: React.FC<M7ValidationCenterProps> = ({
  rules,
  issues,
  onSelectAsset
}) => {
  const [activeTab, setActiveTab] = useState<'RULES' | 'DRY_RUN' | 'ISSUES'>('RULES');
  const [selectedRuleId, setSelectedRuleId] = useState<string>(rules[0]?.id || '');
  const [dryRunRule, setDryRunRule] = useState<ValidationRule | null>(null);
  const [isRunningDryRun, setIsRunningDryRun] = useState(false);
  const [dryRunCompleted, setDryRunCompleted] = useState(false);

  const selectedRule = rules.find(r => r.id === selectedRuleId) || rules[0];

  const handleTriggerDryRun = (rule: ValidationRule) => {
    setDryRunRule(rule);
    setIsRunningDryRun(true);
    setDryRunCompleted(false);
    setTimeout(() => {
      setIsRunningDryRun(false);
      setDryRunCompleted(true);
    }, 400);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950">
      {/* Left List of Rules / Issues */}
      <div className="w-80 sm:w-96 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-white flex items-center gap-2">
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
                <h2 className="text-base font-bold text-white">{selectedRule.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {selectedRule.category}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                作用域: <strong className="text-slate-300">{selectedRule.scope}</strong> ｜ 
                等级: <strong className="text-rose-400">{selectedRule.severity} (阻断级)</strong>
              </p>
            </div>

            <button
              onClick={() => handleTriggerDryRun(selectedRule)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>立即全量元数据试运行 (Dry Run)</span>
            </button>
          </div>

          {/* DSL Code Display */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-400" />
                <span>声明式校验 DSL 规则定义</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">状态: {selectedRule.enabled ? '已启用 (Enabled)' : '试运行中'}</span>
            </div>
            <pre className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-amber-200/90 overflow-x-auto border border-slate-800 leading-relaxed">
              {selectedRule.expression}
            </pre>
          </div>

          {/* Fix Hint & Guidance */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              修复指引与治理建议 (Fix Hint)
            </h4>
            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 leading-relaxed">
              {selectedRule.fixHint}
            </p>
          </div>

          {/* Dry-Run Sandbox Results */}
          {dryRunRule && dryRunRule.id === selectedRule.id && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>试运行检测报告 (Dry-Run Preview)</span>
                </h4>
                {isRunningDryRun ? (
                  <span className="text-xs text-amber-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    正在扫描 482 项元数据...
                  </span>
                ) : (
                  <span className="text-xs text-emerald-400 font-mono">
                    扫描完成：耗时 42ms
                  </span>
                )}
              </div>

              {!isRunningDryRun && dryRunCompleted && (
                <div className="space-y-2">
                  {selectedRule.dryRunHits && selectedRule.dryRunHits.length > 0 ? (
                    selectedRule.dryRunHits.map((hit, idx) => (
                      <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-rose-500/30 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-rose-300 font-bold">{hit.assetName}</span>
                            <span className="text-slate-400 font-mono text-[10px]">({hit.assetId})</span>
                          </div>
                          <div className="text-slate-300 text-[11px] mt-1">{hit.reason}</div>
                        </div>

                        <button
                          onClick={() => onSelectAsset(hit.assetId)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1"
                        >
                          <span>查看资产</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>干跑通过！存量元数据均符合本规则要求，可放心全域启用。</span>
                    </div>
                  )}
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
            <h2 className="text-base font-bold text-white">质量问题闭环台账 (Quality Issues Ledger)</h2>
            <p className="text-xs text-slate-400 mt-0.5">承接核对报告 35 项问题，已全部完成资产 ID 强绑定，杜绝断链</p>
          </div>

          <div className="space-y-3">
            {issues.map(iss => (
              <div key={iss.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-rose-400">{iss.code}</span>
                    <span className="font-semibold text-white text-sm">{iss.title}</span>
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
