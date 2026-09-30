import React, { useState } from 'react';
import { 
  BookOpen, 
  X, 
  Database, 
  Eye, 
  Globe, 
  Cpu, 
  Binary, 
  LayoutDashboard, 
  FileText, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Route, 
  ShieldAlert, 
  Search, 
  Layers, 
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Tag
} from 'lucide-react';
import { AssetType, LayerType } from '../types/lineage';

interface GraphLegendPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  selectedTypeFilter?: string | null;
  onSelectTypeFilter?: (type: string | null) => void;
}

export const GraphLegendPanel: React.FC<GraphLegendPanelProps> = ({
  isOpen,
  onToggle,
  onClose,
  selectedTypeFilter,
  onSelectTypeFilter
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'NODES' | 'EDGES' | 'LAYERS' | 'STATUS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Node type definitions
  const nodeTypes = [
    {
      type: 'TABLE' as AssetType,
      name: '物理表 (Table)',
      icon: Database,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      tagColor: 'bg-blue-950 text-blue-300 border-blue-800',
      description: '实体关系型数据库表（PostgreSQL、MySQL、ClickHouse 等），具备物理存储、主外键及分区设计。',
      example: 'ods_crm_customer, dwd_customer, dws_user_profile_wide'
    },
    {
      type: 'VIEW' as AssetType,
      name: '逻辑视图 (View)',
      icon: Eye,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      tagColor: 'bg-purple-950 text-purple-300 border-purple-800',
      description: '通过 SQL 查询动态计算的虚拟表或物化视图，逻辑解耦下游消费，避免物理数据冗余。',
      example: 'v_active_customers_30d, v_vip_customer_summary'
    },
    {
      type: 'API' as AssetType,
      name: '数据服务接口 (API)',
      icon: Globe,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      tagColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
      description: '线上微服务或前端对外提供的 RESTful / RPC 数据服务，作为数据血缘图谱的终端业务消费者。',
      example: 'api:vip_customer_query, api:credit_risk_evaluation'
    },
    {
      type: 'JOB' as AssetType,
      name: '计算作业 (Job)',
      icon: Cpu,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
      tagColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
      description: '批处理或流式计算任务（Flink、Spark、dbt、Python Script），负责字段清洗、跨源关联与聚合转换。',
      example: 'job_sync_crm_to_dwd, dbt_run_dws_trade_daily'
    },
    {
      type: 'METRIC' as AssetType,
      name: '指标资产 (Metric)',
      icon: Binary,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      tagColor: 'bg-amber-950 text-amber-300 border-amber-800',
      description: '标准化原子指标或派生复合统计口径，绑定具体数仓字段，统一全司口径标准与度量口径。',
      example: 'metric_m_cust_vip_cnt, metric_m_trade_gmv_sum'
    },
    {
      type: 'REPORT' as AssetType,
      name: '报表与仪表盘 (Report / Dashboard)',
      icon: LayoutDashboard,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      tagColor: 'bg-rose-950 text-rose-300 border-rose-800',
      description: '商业智能决策看板、运营大盘或数据报表，直接面向业务决策者与管理层。',
      example: 'ads_vip_overview_dashboard, rpt_customer_churn_weekly'
    }
  ];

  // Edge type definitions
  const edgeTypes = [
    {
      name: '物理主数据流 (Flow / Strong Dependency)',
      style: 'solid',
      strokeColor: '#6366f1',
      badge: '实线 · 置信度 ≥ 90%',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      description: '由 CDC 实时监听、OpenLineage 运行期追踪或显式 ETL 任务捕获的物理数据流转强依赖。',
      semantics: '上游数据变动将直接物理流向并更新下游节点，具备极高准确度。'
    },
    {
      name: '推断依赖 (Inferred Dependency)',
      style: 'dashed',
      strokeColor: '#f59e0b',
      badge: '虚线 · 置信度 < 90%',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      description: '通过 SQL AST 静态解析、存储过程引用或配置规则推导得出的间接引用关系。',
      semantics: '存在动态条件或隐式转换可能，建议由数据开发人员通过契约复核。'
    },
    {
      name: '破坏性变更波及路径 (Breaking Flow)',
      style: 'breaking',
      strokeColor: '#f43f5e',
      badge: '高危红线 · 阻断报警',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      description: '上游发生了删列、列重命名或不兼容数据类型改动，直接导致下游消费代码或模型断流。',
      semantics: 'CI 门禁将拦截部署，需要创建向前兼容临时视图或同步执行下游适配。'
    },
    {
      name: '最短数据流主链路 (Shortest Path)',
      style: 'shortest',
      strokeColor: '#06b6d4',
      badge: '青蓝流光 · 诊断高亮',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      description: '起点与终点之间的关键连通链路，展示数据流经的最少跳数管道与瓶颈置信度。',
      semantics: '用于排查数据延迟瓶颈、口径异常根因溯源及跨域数据传递链。'
    },
    {
      name: '字段级衍生血缘 (Column Lineage)',
      style: 'column',
      strokeColor: '#38bdf8',
      badge: '细线插槽 · 转换表达式',
      badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      description: '展开物理表或视图后，展示源字段到目标字段的具体映射函数（如 CONCAT、SHA256、CASE WHEN）。',
      semantics: '细粒度追踪字段隐私分级、敏感数据流向及计算口径一致性。'
    }
  ];

  // Architecture layers
  const layerDefinitions: { code: LayerType; name: string; desc: string; bg: string }[] = [
    { code: 'ODS', name: '原始操作数据层 (Operational Data Store)', desc: '贴源数据接入，结构与业务生产系统库完全一致，无损保真备份。', bg: 'border-blue-500/40 text-blue-400 bg-blue-950/20' },
    { code: 'DWD', name: '明细数据层 (Data Warehouse Detail)', desc: '标准化数据清洗、维度建模统一编码、个人隐私 PII 字段脱敏加密。', bg: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20' },
    { code: 'DWS', name: '服务汇总层 (Data Warehouse Summary)', desc: '面向特定业务域（客户、交易、风控）的主题宽表与轻度多维指标聚合。', bg: 'border-indigo-500/40 text-indigo-400 bg-indigo-950/20' },
    { code: 'ADS', name: '应用数据层 (Application Data Service)', desc: '直接面向业务报表、专题分析与算法特征工程的高性能宽表与数据集。', bg: 'border-purple-500/40 text-purple-400 bg-purple-950/20' },
    { code: 'APP', name: '终端应用与服务 (Application / Service)', desc: 'BI 可视化看板、对外 OpenAPI 数据服务或微服务实时下游消费者。', bg: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20' }
  ];

  // Status definitions
  const statusDefinitions = [
    { status: 'ACTIVE', label: '治理健康 (Healthy)', color: 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300', dot: 'bg-emerald-400', desc: '契约已绑定，血缘置信度 > 95%，CI 校验与质量规则全部绿灯。' },
    { status: 'PENDING_CHANGE', label: '变更审批中 (Pending Change)', color: 'border-yellow-500/50 bg-yellow-950/30 text-yellow-300', dot: 'bg-yellow-400', desc: '关联 Pull Request 待合入，或已触发变更影响评估但尚未获得下游确认。' },
    { status: 'UNMANAGED', label: '未纳管契约 (Unmanaged)', color: 'border-rose-500/50 bg-rose-950/30 text-rose-300', dot: 'bg-rose-400', desc: '缺失数据契约定义，属于暗改风险区或遗留历史实体。' },
    { status: 'STALE', label: '可能陈旧 (Stale)', color: 'border-amber-500/50 bg-amber-950/30 text-amber-300', dot: 'bg-amber-400', desc: '超过 30 天未更新或元数据采集未按周期刷新。' }
  ];

  // Filtering based on search query
  const filteredNodeTypes = nodeTypes.filter(n => 
    !searchQuery || 
    n.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEdgeTypes = edgeTypes.filter(e => 
    !searchQuery || 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.semantics.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLayers = layerDefinitions.filter(l => 
    !searchQuery || 
    l.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Floating Toggle Button anchored in the graph view */}
      <div className="absolute bottom-5 left-5 z-30 flex items-center gap-2 select-none">
        <button
          onClick={onToggle}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl backdrop-blur-md transition-all duration-200 shadow-xl border cursor-pointer ${
            isOpen
              ? 'bg-indigo-600 text-white border-indigo-400/60 shadow-indigo-500/30 ring-2 ring-indigo-500/40'
              : 'bg-slate-900/90 hover:bg-slate-800/95 text-slate-200 border-slate-700/80 hover:border-indigo-500/50 shadow-black/40 hover:text-white'
          }`}
          title="点击展示/隐藏血缘图例与要素说明"
        >
          <BookOpen className={`w-4 h-4 ${isOpen ? 'text-white' : 'text-indigo-400'}`} />
          <span className="text-xs font-semibold tracking-wide">图例说明</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
            isOpen ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-300'
          }`}>
            Legend
          </span>
          <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-300 animate-pulse' : 'bg-indigo-400'}`} />
        </button>

        {/* Quick status summary tooltip pill next to the button when closed */}
        {!isOpen && (
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800/80 text-[11px] text-slate-400 shadow-lg pointer-events-none">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-indigo-500 inline-block rounded" />
              <span>主数据流 (Flow)</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 border-b border-dashed border-amber-400 inline-block" />
              <span>推断依赖 (Inferred)</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              <span>破坏性波及</span>
            </span>
          </div>
        )}
      </div>

      {/* Descriptive Legend Floating Modal Panel */}
      {isOpen && (
        <div 
          className="absolute bottom-16 left-5 z-40 w-[420px] max-w-[calc(100vw-2.5rem)] max-h-[75vh] backdrop-blur-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl rounded-2xl overflow-hidden flex flex-col transition-all duration-200 animate-fade-in"
          style={{ boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 20px rgba(99, 102, 241, 0.15)' }}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-400">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <span>血缘图谱图例与要素规范</span>
                  <span className="text-[10px] font-normal text-indigo-300 font-mono px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-800">
                    SPEC v2.4
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  资产节点分类、连线依赖类型与数仓分层标准
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              title="关闭图例"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Bar & Tabs */}
          <div className="p-2.5 border-b border-slate-800/80 bg-slate-900/50 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="搜索要素类型 (如 Table, API, 虚线, 破坏性)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/90 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-1 scrollbar-none">
              {(
                [
                  { id: 'ALL', label: '全部' },
                  { id: 'NODES', label: '节点类型 (Node)' },
                  { id: 'EDGES', label: '连线与流向 (Edge)' },
                  { id: 'LAYERS', label: '数仓分层 (Layer)' },
                  { id: 'STATUS', label: '状态与风险 (Status)' }
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2 py-1 rounded-md font-medium whitespace-nowrap transition cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area with Smooth Scroll */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs divide-y divide-slate-800/60">
            {/* Section 1: Node Types */}
            {(activeTab === 'ALL' || activeTab === 'NODES') && (
              <div className="space-y-2.5 pt-1 first:pt-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-400" />
                    <span>节点资产类型 (Node Types)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">共 {filteredNodeTypes.length} 类</span>
                </div>

                <div className="space-y-2">
                  {filteredNodeTypes.map(item => {
                    const Icon = item.icon;
                    const isSelected = selectedTypeFilter === item.type;

                    return (
                      <div
                        key={item.type}
                        onClick={() => onSelectTypeFilter && onSelectTypeFilter(isSelected ? null : item.type)}
                        className={`p-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-indigo-950/60 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                        } cursor-pointer group`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg border ${item.color}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white text-xs">{item.name}</span>
                                <span className={`text-[9px] font-mono px-1 rounded border ${item.tagColor}`}>
                                  {item.type}
                                </span>
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 font-medium">
                              高亮中
                            </span>
                          )}
                        </div>

                        <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed">
                          {item.description}
                        </p>

                        <div className="mt-2 text-[10px] text-slate-500 font-mono bg-slate-900/80 p-1.5 rounded border border-slate-800 flex items-center justify-between">
                          <span className="truncate">示例: {item.example}</span>
                          <span className="text-indigo-400 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                            {isSelected ? '取消高亮' : '点击聚焦'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: Edge & Flow Types */}
            {(activeTab === 'ALL' || activeTab === 'EDGES') && (
              <div className="space-y-2.5 pt-3 first:pt-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <Route className="w-3.5 h-3.5 text-cyan-400" />
                    <span>连线与流向定义 (Edge & Flow)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">共 {filteredEdgeTypes.length} 种</span>
                </div>

                <div className="space-y-2">
                  {filteredEdgeTypes.map(edge => (
                    <div
                      key={edge.name}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          {/* Visual line swatch */}
                          <div className="w-10 h-4 flex items-center justify-center bg-slate-900 rounded border border-slate-800 px-1">
                            {edge.style === 'solid' && (
                              <svg className="w-full h-2">
                                <line x1="0" y1="4" x2="28" y2="4" stroke="#6366f1" strokeWidth="2.5" />
                                <polygon points="26,1 32,4 26,7" fill="#6366f1" />
                              </svg>
                            )}
                            {edge.style === 'dashed' && (
                              <svg className="w-full h-2">
                                <line x1="0" y1="4" x2="28" y2="4" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />
                                <polygon points="26,1 32,4 26,7" fill="#f59e0b" />
                              </svg>
                            )}
                            {edge.style === 'breaking' && (
                              <svg className="w-full h-2">
                                <line x1="0" y1="4" x2="28" y2="4" stroke="#f43f5e" strokeWidth="2.5" />
                                <polygon points="26,1 32,4 26,7" fill="#f43f5e" />
                              </svg>
                            )}
                            {edge.style === 'shortest' && (
                              <svg className="w-full h-2">
                                <line x1="0" y1="4" x2="28" y2="4" stroke="#06b6d4" strokeWidth="3" />
                                <polygon points="26,1 32,4 26,7" fill="#06b6d4" />
                              </svg>
                            )}
                            {edge.style === 'column' && (
                              <svg className="w-full h-2">
                                <line x1="0" y1="4" x2="28" y2="4" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="2 2" />
                                <circle cx="30" cy="4" r="2" fill="#38bdf8" />
                              </svg>
                            )}
                          </div>
                          <span className="font-semibold text-white text-xs">{edge.name}</span>
                        </div>

                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${edge.badgeColor}`}>
                          {edge.badge}
                        </span>
                      </div>

                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        {edge.description}
                      </p>

                      <div className="mt-1.5 text-[10px] text-slate-300 bg-slate-900/80 px-2 py-1 rounded border border-slate-800/80 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span>{edge.semantics}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 3: Data Warehouse Swimlane Layers */}
            {(activeTab === 'ALL' || activeTab === 'LAYERS') && (
              <div className="space-y-2.5 pt-3 first:pt-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span>数仓分层泳道规范 (Layers)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">5 层架构</span>
                </div>

                <div className="space-y-2">
                  {filteredLayers.map(l => (
                    <div 
                      key={l.code}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${l.bg}`}>
                          {l.code}
                        </span>
                        <span className="font-semibold text-white text-xs">{l.name}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        {l.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 4: Status Badges */}
            {(activeTab === 'ALL' || activeTab === 'STATUS') && (
              <div className="space-y-2.5 pt-3 first:pt-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>资产健康状态与徽标 (Status)</span>
                  </span>
                </div>

                <div className="space-y-2">
                  {statusDefinitions.map(s => (
                    <div 
                      key={s.status}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5"
                    >
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${s.dot}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${s.color}`}>
                            {s.label}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-1">
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-[10px]">
              <HelpCircle className="w-3 h-3 text-indigo-400" />
              <span>按 Esc 或再次点击浮动按钮可快速收起</span>
            </span>
            <button
              onClick={onClose}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
            >
              完成查看
            </button>
          </div>
        </div>
      )}
    </>
  );
};
