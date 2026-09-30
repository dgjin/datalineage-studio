import React, { useState } from 'react';
import { 
  Asset, 
  ChangeType, 
  ImpactVerdict, 
  ImpactReport, 
  ImpactItem 
} from '../../types/lineage';
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
  const [selectedColumn, setSelectedColumn] = useState<string>('phone');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [report, setReport] = useState<ImpactReport | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Modal states for Ack & Exemption
  const [activeAckItem, setActiveAckItem] = useState<ImpactItem | null>(null);
  const [exemptionReason, setExemptionReason] = useState('');
  const [showAckSuccessToast, setShowAckSuccessToast] = useState<string | null>(null);

  const selectedAsset = assets.find(a => a.id === selectedAssetId) || assets[0];

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      // Generate impact report based on selection
      let verdict: ImpactVerdict = 'BLOCKER';
      let score = 92;
      let summary = '此变更拟直接删除核心 phone 明文列，波及下游 1 个DWD表、1 个核心指标、1 个对外API及监管大屏，建议直接阻断！';
      let criticalPaths = [
        ['ods_crm_customer.phone', 'dwd_customer_info.masked_phone', 'metric:active_customer_cnt', 'report:crm_risk_overview'],
        ['ods_crm_customer.phone', 'ads_vip_customer_portrait', 'api:vip_customer_query']
      ];
      let directImpacts: ImpactItem[] = [
        {
          id: 'imp:1',
          objectId: 'asset:metric:active_customer_cnt',
          objectName: '当期有效活跃客户数 (MET-CRM-ACT-001)',
          type: 'METRIC',
          distance: 2,
          via: '过滤条件与关联清洗引用 phone',
          owner: '林峰 (指标主管)',
          department: '数据治理与指标委员会',
          ackStatus: 'PENDING'
        },
        {
          id: 'imp:2',
          objectId: 'asset:dwd_customer_info',
          objectName: '客户域标准化明细表 (dwd_customer_info)',
          type: 'TABLE',
          distance: 1,
          via: '表达式 CONCAT(LEFT(phone,3), "****") 强依赖',
          owner: '陈敏 (数据数仓组)',
          department: '大数据平台部',
          ackStatus: 'ACKED'
        },
        {
          id: 'imp:3',
          objectId: 'asset:api:vip_customer_query',
          objectName: 'VIP 客户实时权益 OpenAPI',
          type: 'API',
          distance: 3,
          via: '下游集市对外接口序列化',
          owner: '张伟 (CRM架构师)',
          department: '中台开放平台部',
          ackStatus: 'PENDING'
        }
      ];

      let suggestions = [
        '【双写平滑过渡】：在契约中保留 phone 列并标记 DEPRECATED，新增 phone_hash 与 masked_phone 进行双写运行 2 个发布周期。',
        '【CI 卡点阻断】：此破坏性变更在全部下游 Owner 确认 (Ack) 或架构师签署阶段性豁免单前，禁止合并入生产主干。',
        '【创建兼容视图】：建议为下游提供向前兼容的数据库视图屏蔽物理表字段变动。'
      ];

      let mitigationCodeSnippet: string | undefined = `-- 架构师推荐向前兼容临时视图 (Forward Compatibility View)
CREATE OR REPLACE VIEW ods_crm_customer_compat AS
SELECT 
    cust_id,
    cust_name,
    -- 向前兼容桩逻辑：将已弃用明文字段返回为空或掩码，避免下游断链
    COALESCE(phone_hash, 'DEPRECATED') AS phone,
    phone_hash,
    cert_type,
    cert_no_enc,
    cust_status,
    created_time
FROM ods_crm_customer;`;

      if (changeType === 'ADD_NULLABLE_COLUMN') {
        verdict = 'SAFE';
        score = 5;
        summary = '新增可空列且无历史字段破坏，向下完全兼容，系统将自动放行发布。';
        criticalPaths = [];
        directImpacts = [];
        suggestions = ['无需下游确认，CI 兼容性检查已自动通过。'];
        mitigationCodeSnippet = undefined;
      } else if (changeType === 'CHANGE_DATA_TYPE') {
        verdict = 'HIGH';
        score = 78;
        summary = '字段数据类型变更可能引发下游隐式类型转换失败或高精度溢出截断。';
      }

      setReport({
        assetId: selectedAsset.id,
        assetName: selectedAsset.name,
        changeType,
        targetField: selectedColumn,
        verdict,
        score,
        summary,
        criticalPaths,
        directImpacts,
        suggestions,
        mitigationCodeSnippet
      });
      setIsSimulating(false);
    }, 450);
  };

  const handleAckAction = (item: ImpactItem, action: 'ACK' | 'EXEMPT') => {
    if (!report) return;
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
    setShowAckSuccessToast(`已成功为 ${item.objectName} 处理确认事项！`);
    setTimeout(() => setShowAckSuccessToast(null), 3000);
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
              onChange={(e) => {
                setSelectedAssetId(e.target.value);
                const a = assets.find(x => x.id === e.target.value);
                if (a?.columns && a.columns.length > 0) {
                  setSelectedColumn(a.columns[0].name);
                }
              }}
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
            {selectedAsset?.columns && selectedAsset.columns.length > 0 ? (
              <select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
              >
                {selectedAsset.columns.map(c => (
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
                <span className="text-[11px] text-slate-400">按波及深度排序</span>
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
                            className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition"
                          >
                            确认影响 (Ack)
                          </button>
                          <button
                            onClick={() => setActiveAckItem(item)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
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
                disabled={!exemptionReason.trim()}
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
