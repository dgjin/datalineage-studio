import React, { useState } from 'react';
import { 
  FileCheck2, 
  FolderTree, 
  FileCode, 
  Database, 
  Copy, 
  Check, 
  ExternalLink, 
  GitPullRequest, 
  CheckCircle2, 
  AlertTriangle,
  Play
} from 'lucide-react';
import { SAMPLE_CONTRACT_YAML } from '../../mock/mockData';

interface M6ContractBrowserProps {
  initialContractRef?: string;
  onSimulateChange: (assetId: string) => void;
}

export const M6ContractBrowser: React.FC<M6ContractBrowserProps> = ({
  initialContractRef = 'contracts/crm/customer.yaml',
  onSimulateChange
}) => {
  const [selectedFile, setSelectedFile] = useState<string>(initialContractRef);
  const [activeView, setActiveView] = useState<'YAML' | 'DDL' | 'CI_CHECKS'>('YAML');
  const [copiedText, setCopiedText] = useState(false);

  const sampleDdl = `-- ==============================================================
-- 自动生成的 PostgreSQL 物理建表 DDL (由契约编译引擎生成)
-- 契约来源: contracts/crm/customer.yaml
-- ==============================================================
CREATE TABLE IF NOT EXISTS ods_crm_customer (
    cust_id BIGINT NOT NULL,
    cust_name VARCHAR(128) NOT NULL,
    phone VARCHAR(20) NULL, -- [DEPRECATED] 计划在 v2.2 彻底移除
    phone_hash VARCHAR(64) NOT NULL,
    cert_type VARCHAR(8) NOT NULL,
    cert_no_enc VARCHAR(128) NOT NULL,
    cust_status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_time TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    
    CONSTRAINT pk_ods_crm_customer PRIMARY KEY (cust_id)
);

COMMENT ON TABLE ods_crm_customer IS 'CRM 客户全量数据契约映射表';
COMMENT ON COLUMN ods_crm_customer.cust_id IS '统一客户唯一标识符';
COMMENT ON COLUMN ods_crm_customer.phone_hash IS '手机号加盐哈希值';`;

  const ciChecks = [
    { name: 'YAML 语法与 JSON Schema 校验', status: 'PASS', detail: '符合 Data Contract v2.0 规范' },
    { name: 'VR-001 资产全局编码合规性', status: 'PASS', detail: 'ODS-CRM-CUST-001 命名格式有效' },
    { name: '向前兼容性检查 (Backward Compatibility)', status: 'WARN', detail: '检测到 phone 列被标记为 DEPRECATED，需下游 Ack 确认' },
    { name: '全域血缘拓扑影响预演 (lineage-cli)', status: 'PASS', detail: '已成功生成影响报告，无未放行的 BLOCKER 级硬错误' }
  ];

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950">
      {/* File Tree Left Navigation */}
      <div className="w-72 border-r border-slate-800 flex flex-col shrink-0 bg-slate-900/40">
        <div className="p-4 border-b border-slate-800 space-y-1">
          <div className="text-xs font-bold text-white flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-indigo-400" />
            <span>Git 契约仓库目录 (Contracts Repo)</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Git 作为元数据唯一写入事实来源 (No Backdoor)
          </p>
        </div>

        {/* Tree List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs font-mono">
          <div className="text-slate-400 px-2 py-1 font-sans text-[11px] font-semibold flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-slate-500" />
            <span>crm (客户域)</span>
          </div>
          <button
            onClick={() => setSelectedFile('contracts/crm/customer.yaml')}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition ${
              selectedFile === 'contracts/crm/customer.yaml'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>customer.yaml</span>
          </button>
          <button
            onClick={() => setSelectedFile('contracts/crm/dwd_customer.yaml')}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition ${
              selectedFile === 'contracts/crm/dwd_customer.yaml'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>dwd_customer.yaml</span>
          </button>

          <div className="text-slate-400 px-2 py-1 font-sans text-[11px] font-semibold mt-2 flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-slate-500" />
            <span>trade (交易结算域)</span>
          </div>
          <button
            onClick={() => setSelectedFile('contracts/trade/order.yaml')}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition ${
              selectedFile === 'contracts/trade/order.yaml'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>order.yaml</span>
          </button>
        </div>

        {/* Git Info */}
        <div className="p-3 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
          <span>Branch: <code className="text-indigo-400">main</code></span>
          <span className="font-mono text-emerald-400">Sync: 100%</span>
        </div>
      </div>

      {/* Main File Content / DDL / Checks */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-white">{selectedFile}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                已同步 (Synced)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              声明式契约规范文件，由架构师在 Git 审查合并后自动广播至各层适配器
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSimulateChange('asset:ods_crm_customer')}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Play className="w-3.5 h-3.5 text-amber-400" />
              <span>CI 影响预演</span>
            </button>
            <button
              onClick={() => handleCopy(activeView === 'YAML' ? SAMPLE_CONTRACT_YAML : sampleDdl)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedText ? '已复制' : '复制内容'}</span>
            </button>
          </div>
        </div>

        {/* View Switcher Bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-950/60 text-xs">
          <button
            onClick={() => setActiveView('YAML')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeView === 'YAML' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            契约 YAML 原文 (只读)
          </button>
          <button
            onClick={() => setActiveView('DDL')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeView === 'DDL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            自动生成的 DDL 预览
          </button>
          <button
            onClick={() => setActiveView('CI_CHECKS')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeView === 'CI_CHECKS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            MR CI 检查项面板
          </button>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeView === 'YAML' && (
            <pre className="p-4 bg-slate-950 rounded-xl font-mono text-xs text-indigo-200/90 overflow-x-auto border border-slate-800/80 leading-relaxed shadow-inner">
              {SAMPLE_CONTRACT_YAML}
            </pre>
          )}

          {activeView === 'DDL' && (
            <pre className="p-4 bg-slate-950 rounded-xl font-mono text-xs text-emerald-300/90 overflow-x-auto border border-slate-800/80 leading-relaxed shadow-inner">
              {sampleDdl}
            </pre>
          )}

          {activeView === 'CI_CHECKS' && (
            <div className="space-y-3 max-w-2xl">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                GitLab/Gitea CI 自动化流水线检查结果 (Pipeline #94821)
              </h3>
              <div className="space-y-2 text-xs">
                {ciChecks.map((chk, i) => (
                  <div key={i} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white block">{chk.name}</span>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">{chk.detail}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      chk.status === 'PASS' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {chk.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
