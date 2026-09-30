import React, { useState } from 'react';
import { CollectorAdapter } from '../../types/lineage';
import { LayerImportPanel } from '../LayerImportPanel';
import { 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  RotateCcw, 
  Play, 
  Sliders, 
  FileCode, 
  Plus, 
  Clock, 
  ArrowRight,
  Layers,
  Database
} from 'lucide-react';

interface M10CollectorAdminProps {
  collectors: CollectorAdapter[];
}

export const M10CollectorAdmin: React.FC<M10CollectorAdminProps> = ({ collectors }) => {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'COLLECTORS' | 'LAYER_IMPORT' | 'METAMODEL'>('COLLECTORS');

  const handleTestConnection = (id: string) => {
    setTestingId(id);
    setTimeout(() => {
      setTestResult(prev => ({ ...prev, [id]: '连接成功 (Ping: 12ms, 权限校验正常)' }));
      setTestingId(null);
    }, 500);
  };

  const sampleMetaModelYaml = `# ==============================================================
# 通用元模型动态配置 (Universal Meta-Model Schema Definition)
# 无需改动任何系统代码，通过配置即刻支持新资产与新关系
# ==============================================================
assetType: ML_MODEL
display: 机器学习特征与模型
icon: brain
layers: [ADS, APP]

propertiesSchema:
  type: object
  properties:
    framework: 
      type: string
      enum: [xgboost, pytorch, lightgbm, tensorflow]
    trainJobRef: 
      type: string
      ref: JOB
    aucMetric: 
      type: number
      title: "验证集 AUC 评分"
    featureCount:
      type: integer

relationTypes:
  - id: TRAINED_FROM
    from: ML_MODEL
    to: TABLE
    directed: true
    semantic: DATA_FLOW
    affectsImpactAnalysis: true
    
  - id: SERVED_BY
    from: ML_MODEL
    to: API
    directed: true
    semantic: DATA_FLOW
    affectsImpactAnalysis: true`;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <span>M10 采集适配器与元模型扩展引擎</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            通用性保障：采集器可插拔（不绑定任何物理数据源）、元模型可动态扩展（新增资产类型不改代码）
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('COLLECTORS')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'COLLECTORS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            采集适配器管理
          </button>
          <button
            onClick={() => setActiveTab('LAYER_IMPORT')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'LAYER_IMPORT' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            分层导入（跨数据源）
          </button>
          <button
            onClick={() => setActiveTab('METAMODEL')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'METAMODEL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            元模型 Schema 扩展
          </button>
        </div>
      </div>

      {activeTab === 'COLLECTORS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>已注册 4 类主流采集模式 (Pull, Push, Scan) 适配器：</span>
            <span className="text-emerald-400 font-mono">健康度均值: 99%</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {collectors.map(col => (
              <div key={col.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-semibold">
                        {col.mode}
                      </span>
                      <h3 className="font-bold text-white text-sm">{col.name}</h3>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block mt-1">
                      类型: {col.type} ｜ 最近同步: {col.lastRunTime}
                    </span>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {col.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">纳管资产数</span>
                    <span className="font-mono font-bold text-white">{col.totalAssetsDiscovered}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">24h 捕获变更</span>
                    <span className="font-mono font-bold text-amber-400">{col.changesCaptured24h}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">平均延迟</span>
                    <span className="font-mono font-bold text-emerald-400">{col.avgLatency}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-wrap gap-1">
                    {col.capabilities.map(cap => (
                      <span key={cap} className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {cap}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => handleTestConnection(col.id)}
                    disabled={testingId === col.id}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium flex items-center gap-1"
                  >
                    {testingId === col.id ? (
                      <>
                        <Clock className="w-3 h-3 animate-spin" />
                        <span>测试中...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        <span>凭据测试</span>
                      </>
                    )}
                  </button>
                </div>

                {testResult[col.id] && (
                  <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{testResult[col.id]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'LAYER_IMPORT' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>多数据源分层导入：ODS / DWD / DWS / ADS / APP 各层可从不同数据源独立采集，并声明层间流向自动建立跨源血缘</span>
          </div>
          <LayerImportPanel />
        </div>
      )}

      {activeTab === 'METAMODEL' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <h3 className="font-bold text-white text-sm">
              动态元模型配置示例 (Dynamic Meta-Model Configuration)
            </h3>
            <p className="text-slate-400">
              通过声明式的 JSON Schema 规范定义新的业务资产类型（如机器学习模型、大语言模型 Prompt、流式计算等），系统自动为其生成属性表单、详情面板与血缘关系渲染规则。
            </p>
          </div>

          <pre className="p-4 bg-slate-950 rounded-xl font-mono text-cyan-200/90 text-xs overflow-x-auto border border-slate-800 leading-relaxed shadow-inner">
            {sampleMetaModelYaml}
          </pre>
        </div>
      )}
    </div>
  );
};
