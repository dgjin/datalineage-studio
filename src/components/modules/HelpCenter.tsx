import React, { useRef, useState } from 'react';
import {
  LifeBuoy,
  Compass,
  Wrench,
  Radar,
  Search,
  GitFork,
  AlertOctagon,
  Activity,
  ShieldCheck,
  Server,
  Cpu,
  Play,
  Layers,
  BookOpen,
  ShieldAlert,
  BarChart3,
  ArrowRight,
  ArrowDown,
  RefreshCw,
  ChevronRight,
  Keyboard,
  Lightbulb,
  Terminal,
  HelpCircle,
  Workflow
} from 'lucide-react';
import { NavTab } from '../Sidebar';

type HelpRole = 'USER' | 'ADMIN';

interface ToneSet {
  badge: string;
  icon: string;
  chapter: string;
}

/** Static class strings per tone (Tailwind scans literals only). */
const TONES: Record<string, ToneSet> = {
  indigo: {
    badge: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300',
    icon: 'text-indigo-400',
    chapter: 'from-indigo-500/60',
  },
  cyan: {
    badge: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
    icon: 'text-cyan-400',
    chapter: 'from-cyan-500/60',
  },
  violet: {
    badge: 'bg-violet-500/15 border-violet-500/40 text-violet-300',
    icon: 'text-violet-400',
    chapter: 'from-violet-500/60',
  },
  amber: {
    badge: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
    icon: 'text-amber-400',
    chapter: 'from-amber-500/60',
  },
  rose: {
    badge: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
    icon: 'text-rose-400',
    chapter: 'from-rose-500/60',
  },
  emerald: {
    badge: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
    icon: 'text-emerald-400',
    chapter: 'from-emerald-500/60',
  },
  sky: {
    badge: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
    icon: 'text-sky-400',
    chapter: 'from-sky-500/60',
  },
  teal: {
    badge: 'bg-teal-500/15 border-teal-500/40 text-teal-300',
    icon: 'text-teal-400',
    chapter: 'from-teal-500/60',
  },
};

interface FlowStep {
  seq: number;
  title: string;
  /** One-line summary shown inside the flow-chart node. */
  subtitle: string;
  /** Module badge, e.g. 'M1 资产目录'. */
  module: string;
  /** Navigation target for the jump button. */
  tab: NavTab;
  icon: React.ElementType;
  tone: string;
  /** Detailed operating paths (menu -> region -> action -> result). */
  paths: string[];
  tips?: string[];
}

const USER_FLOW: FlowStep[] = [
  {
    seq: 1,
    title: '发现问题',
    subtitle: '待办 / 暗改 / 质量问题一屏总览',
    module: '工作台 / M8 通知中心',
    tab: 'workbench',
    icon: Radar,
    tone: 'indigo',
    paths: [
      '打开「工作台」，第一屏即三块巡检面板：待我确认的变更、未纳管暗改巡检、数据质量问题闭环',
      '点击任意卡片直达对应模块处理；需要集中查看全部消息时进入「M8 通知中心」',
      '通知条目自带快捷操作：确认影响（Ack）、查看影响报告、生成契约补丁',
    ],
    tips: ['左侧导航徽标即为全局待办计数器（如「3暗改」「2待确认」），是每日巡检的第一入口'],
  },
  {
    seq: 2,
    title: '定位资产',
    subtitle: '秒级找到表、字段与指标',
    module: 'M1 资产目录 / ⌘K 搜索',
    tab: 'catalog',
    icon: Search,
    tone: 'cyan',
    paths: [
      '按 ⌘K（Windows 为 Ctrl+K）唤起命令面板，支持资产名、字段名（col: 前缀语法）、指标 code、校验规则全文检索',
      'M1 资产目录左侧列表按分层 ODS → DWD → DWS → ADS → APP 过滤，支持空间与状态筛选',
      '资产详情页包含字段清单、上下游计数、血缘来源与八维健康分徽章',
    ],
    tips: ['详情页的「模拟改动」按钮可一键跳转 M3 影响模拟器，形成「查到即评估」的连贯操作'],
  },
  {
    seq: 3,
    title: '探查血缘',
    subtitle: '这个数从哪来？会流向哪里？',
    module: 'M2 血缘探索器',
    tab: 'lineage',
    icon: GitFork,
    tone: 'violet',
    paths: [
      '三种布局：数仓分层泳道（全链路审计）、力导向拓扑（全局关系网）、放射同心圆（选定资产 N 跳影响范围）',
      '顶部切换「表级 / 字段级」粒度；字段级使用「字段映射板」查看列到列的映射与转换表达式（SUM / DATE / UDF 等）',
      '工具栏支持导出高清 SVG / PNG / Mermaid，以及时间旅行回放历史版本图谱',
    ],
    tips: [
      '数仓分层泳道视图按设计只展示泳道分布、不渲染连线；查看完整连线（含跨源青绿色线）请切换到力导向拓扑或放射同心圆',
    ],
  },
  {
    seq: 4,
    title: '影响评估',
    subtitle: '改它会怎样？先模拟再动手',
    module: 'M3 What-If 影响分析',
    tab: 'impact',
    icon: AlertOctagon,
    tone: 'amber',
    paths: [
      '选择目标资产与变更类型（删列 / 改名 / 改类型 / 改指标口径等），一键生成影响评估报告',
      '报告包含风险分级（BLOCKER / HIGH / MEDIUM / LOW / SAFE）、关键路径链、受影响的指标 / 报表 / API / 表清单',
      '报告附带缓解建议与可复制的修复代码片段',
    ],
    tips: ['BLOCKER / HIGH 且已纳管的变更会自动进入审批门禁（M4），须审批通过后才能发布'],
  },
  {
    seq: 5,
    title: '处置与确认',
    subtitle: '确认影响面，闭环每一笔变更',
    module: 'M4 变更中心 / M8',
    tab: 'changes',
    icon: Activity,
    tone: 'rose',
    paths: [
      '「待我确认」页签：作为下游 Owner 对影响项执行确认（Ack）或豁免（须填写理由与到期时间）',
      '「待审批门禁」页签：审批人对高风险变更执行批准 / 驳回，审批流水全程留痕',
      '「全部变更」页签：暗改（绕过契约的直接 DDL）可一键反向生成契约补丁完成补录',
    ],
    tips: ['豁免不是免责——到期后影响项会自动重新进入待确认队列，需再次评估'],
  },
  {
    seq: 6,
    title: '验证闭环',
    subtitle: '现在对不对？规则重跑归零',
    module: 'M7 校验中心',
    tab: 'validation',
    icon: ShieldCheck,
    tone: 'emerald',
    paths: [
      '「规则库」页签查看规则命中情况与 P0 - P2 严重级；「试运行」页签对规则做 dry-run 抽样预览（不落库）',
      '「质量问题」页签跟踪问题修复直至「已解决」，资产健康分随之恢复',
      '治理完成后回到工作台，确认对应待办计数归零',
    ],
    tips: ['采集任务完成后会自动执行命名标准校验（采集即校验），无须手工触发'],
  },
];

const ADMIN_FLOW: FlowStep[] = [
  {
    seq: 1,
    title: '接入数据源',
    subtitle: '按分层规划，先连通再纳管',
    module: 'M11 数据源接入',
    tab: 'datasources',
    icon: Server,
    tone: 'indigo',
    paths: [
      '「新建数据源」：填写主机 / 端口 / 库名 / 账号密码，保存前先点「测试连接」验证连通性',
      '建议按数仓分层拆分数据源（业务库源 / 数仓层源 / 应用层源各一），为后续分层导入打好基础',
      '数据源卡片支持编辑（密码留空则保留原密码）与删除；暂不使用的源执行「停用」',
    ],
    tips: [
      '停用是可逆操作：停用后其采集任务（手动 + 定时两条路径）均被拦截，随时可重新启用；删除不可逆，务必慎用',
    ],
  },
  {
    seq: 2,
    title: '配置采集任务',
    subtitle: '每个分层绑定一个源，定范围与节奏',
    module: 'M10 / M11',
    tab: 'collectors',
    icon: Cpu,
    tone: 'sky',
    paths: [
      '「新建任务」：选择数据源、采集范围（整库 / 指定 Schema / 指定表列表）与目标分层（targetLayers）',
      '配置调度 cron（支持暂停 / 恢复），并按需开启「自动注册资产」「自动发现血缘」开关',
      '任务与数据源停用状态联动：所属数据源被停用的任务在下拉中标注「(已停用)」且不可运行',
    ],
    tips: ['多源场景下，采集前请先完成分层规划（M11 采集目标分层），否则资产无法正确归层'],
  },
  {
    seq: 3,
    title: '执行采集与核查',
    subtitle: '采集即注册，采集即校验',
    module: 'M10 采集与管理',
    tab: 'collectors',
    icon: Play,
    tone: 'teal',
    paths: [
      '「采集适配器管理」页签查看各适配器健康度、近 24h 捕获变更数与平均时延',
      '对任务点「运行」→ 查看运行日志：发现表数 / 列数 / 新增资产数 / 新增血缘边数逐项核对',
      '采集过程中：新资产自动注册、FK / 视图依赖 / SQL 解析血缘自动入库、命名标准自动校验',
    ],
    tips: ['命名违规对象会在采集注册时自动生成质量问题（可在 M7 / M12 查看），这是治理闭环的起点'],
  },
  {
    seq: 4,
    title: '配置分层导入',
    subtitle: '跨数据源打通 ODS → DWD → DWS → ADS → APP',
    module: 'M10 分层导入（跨数据源）',
    tab: 'collectors',
    icon: Layers,
    tone: 'violet',
    paths: [
      '进入「分层导入（跨数据源）」页签，新建关系：From 数据源×分层 → To 数据源×分层',
      '匹配方式二选一：同名匹配（剥层前缀后业务名唯一命中）或 ETL SQL（解析 INSERT INTO … SELECT，生成表级 + 列级映射）',
      '先「预检」做 dry-run：预览可命中的边数、未匹配与歧义明细；确认无误后「构建」（幂等，可反复重建）',
    ],
    tips: [
      '跨源血缘边以青绿色（teal）渲染，需在 M2 力导向拓扑 / 放射同心圆布局下查看（泳道视图不渲染连线）；关系配错可在列表删除，边会级联清理',
    ],
  },
  {
    seq: 5,
    title: '配置数据标准',
    subtitle: '命名 / 词根 / 编码三件套先行',
    module: 'M12 标准中枢',
    tab: 'standards',
    icon: BookOpen,
    tone: 'cyan',
    paths: [
      '「数据标准」页签新建命名标准：正则必须写成完整匹配式，例如 ^(ods|dwd|dws|ads|app|tmp|bak|legacy)_[a-z0-9_]+$',
      '「术语词根」统一业务词汇与定义；「编码字典」维护参考编码集（如性别代码、状态码）',
      '标准支持草稿 → 发布状态流转；「命名校验」按钮可对全量资产发起一次体检',
    ],
    tips: ['正则使用全串匹配（Pattern.matches）——若只写片段（如 ^tmp_）会导致大量资产误判违规，务必写完整表达式'],
  },
  {
    seq: 6,
    title: '配置校验规则',
    subtitle: '规则启停与分级，dry-run 先行',
    module: 'M7 校验中心',
    tab: 'validation',
    icon: ShieldAlert,
    tone: 'amber',
    paths: [
      '「规则库」页签启停规则并确认 P0 - P2 严重级；启用前建议先「试运行」dry-run 观察命中量',
      '命中结果自动进入「质量问题」页签，可指派 Owner 并跟踪至关闭',
      '规则类别覆盖：格式、完整性、语义、DAG 完整性、跨系统一致性',
    ],
    tips: ['新规则先 dry-run 再启用，避免大批量噪声告警淹没真实问题'],
  },
  {
    seq: 7,
    title: '监控与运营',
    subtitle: '健康分与水位的持续复盘',
    module: 'M9 运营看板',
    tab: 'dashboard',
    icon: BarChart3,
    tone: 'emerald',
    paths: [
      '查看资产总量、分层分布、类型分布、平均健康分与风险资产排行（数据全部来自实时 API）',
      '定期复盘：暗改趋势、质量问题存量、审批时效，识别治理薄弱环节',
      '风险资产可一键跳转 M1 详情页处置，形成「看板 → 处置 → 回看」运营节奏',
    ],
    tips: ['资产健康分为八维加权评估——采集覆盖、命名合规、契约完备、血缘完整等维度共同决定分值'],
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: '血缘图上为什么看不到连线？',
    a: '「数仓分层泳道」视图按设计只展示泳道分布、不渲染连线，请切换到「力导向拓扑」或「放射同心圆」布局查看完整连线。',
  },
  {
    q: '青绿色（teal）连线代表什么？',
    a: '跨数据源层间导入血缘。管理员在 M10「分层导入（跨数据源）」构建关系后产生，仅当关闭分层泳道视图时可见。',
  },
  {
    q: '数据源「测试连接」失败怎么办？',
    a: '优先检查主机 / 端口连通性与账号权限；MySQL 8 连接已内置公钥检索兼容参数，一般无须额外配置。确认无误后重试。',
  },
  {
    q: '资产改名后健康分为什么下降？',
    a: '名称不符合已发布的命名标准会被校验命中并生成质量问题，健康分相应扣减。按 M12 标准修正名称后重跑校验即可恢复。',
  },
  {
    q: '如何快速切换到演示数据？',
    a: '运行 ./scripts/switch-demo.sh full | multisource | baseline 一键切换（幂等）。前置条件：数据库容器与后端运行中。',
  },
];

/** Split steps into rows of at most `size` nodes. */
const chunkRows = (steps: FlowStep[], size: number): FlowStep[][] => {
  const rows: FlowStep[][] = [];
  for (let i = 0; i < steps.length; i += size) rows.push(steps.slice(i, i + size));
  return rows;
};

interface HelpCenterProps {
  onNavigateTab: (tab: NavTab) => void;
}

export const HelpCenter: React.FC<HelpCenterProps> = ({ onNavigateTab }) => {
  const [role, setRole] = useState<HelpRole>('USER');
  const [highlightSeq, setHighlightSeq] = useState<number | null>(null);
  const detailRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const steps = role === 'USER' ? USER_FLOW : ADMIN_FLOW;
  const rows = chunkRows(steps, 3);

  const scrollToDetail = (seq: number) => {
    setHighlightSeq(seq);
    detailRefs.current[`${role}-${seq}`]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6 space-y-6">
      {/* ================= Banner ================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/30 p-6 shadow-2xl">
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-semibold">
            <LifeBuoy className="w-3.5 h-3.5 text-cyan-400" />
            <span>帮助中心 · 操作闭环与配置指南</span>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              一张图看懂操作闭环，分步说明直达每个模块
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed mt-1.5 max-w-3xl">
              选择你的角色：<strong>用户</strong>聚焦「发现问题 → 定位 → 探查 → 评估 → 处置 → 验证」日常闭环；
              <strong>管理员</strong>聚焦「接入 → 采集 → 导入 → 标准 → 校验 → 监控」配置管理闭环。点击流程图节点可直达对应分步说明。
            </p>
          </div>

          {/* Role Switch */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setRole('USER'); setHighlightSeq(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                role === 'USER'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
                  : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>用户快速上手</span>
              <span className="text-[10px] opacity-70">6 步日常闭环</span>
            </button>
            <button
              onClick={() => { setRole('ADMIN'); setHighlightSeq(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                role === 'ADMIN'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
                  : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>管理员配置管理</span>
              <span className="text-[10px] opacity-70">7 步配置闭环</span>
            </button>
          </div>
        </div>

        {/* Ambient glow */}
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-indigo-500/10 via-indigo-400/5 to-transparent pointer-events-none" />
        <LifeBuoy className="absolute -right-6 -bottom-8 w-40 h-40 text-indigo-500/5 pointer-events-none" />
      </div>

      {/* ================= Flow Overview ================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Workflow className="w-4 h-4 text-indigo-400" />
            <span>{role === 'USER' ? '用户操作闭环总览' : '管理员配置管理闭环总览'}</span>
          </h2>
          <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
            点击节点 → 定位到分步说明
          </span>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
          {rows.map((row, ri) => (
            <React.Fragment key={ri}>
              <div className="flex flex-col xl:flex-row gap-2 xl:items-stretch">
                {row.map((step, si) => {
                  const tone = TONES[step.tone];
                  const Icon = step.icon;
                  return (
                    <React.Fragment key={step.seq}>
                      <button
                        onClick={() => scrollToDetail(step.seq)}
                        className={`flex-1 min-w-0 text-left p-3 rounded-xl bg-slate-950 border transition group ${
                          highlightSeq === step.seq
                            ? 'border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                            : 'border-slate-800 hover:border-indigo-500/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${tone.badge}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-slate-500">STEP {step.seq}</span>
                              <span className="text-xs font-bold text-slate-100 truncate">{step.title}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">{step.subtitle}</div>
                          </div>
                        </div>
                      </button>
                      {si < row.length - 1 && (
                        <div className="hidden xl:flex items-center justify-center text-slate-600 shrink-0">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              {ri < rows.length - 1 && (
                <div className="hidden xl:flex justify-center py-0.5 text-slate-600">
                  <ArrowDown className="w-4 h-4" />
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Loop-back hint */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 text-[11px] text-emerald-300">
            <RefreshCw className="w-4 h-4 shrink-0" />
            <span>
              {role === 'USER'
                ? '验证闭环后回到第 1 步持续监控 —— 发现问题 → 定位 → 探查 → 评估 → 处置 → 验证，周而复始，每一次循环都留下审计留痕'
                : '配置完成后进入常态化运营 —— 接入 → 采集 → 导入 → 标准 → 校验 → 监控，监控中发现的问题回流为新一轮配置优化'}
            </span>
          </div>
        </div>
      </section>

      {/* ================= Step-by-Step Details ================= */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-indigo-400" />
          <span>分步详细说明</span>
        </h2>

        <div className="space-y-3">
          {steps.map(step => {
            const tone = TONES[step.tone];
            const Icon = step.icon;
            const isActive = highlightSeq === step.seq;
            return (
              <div
                key={`${role}-${step.seq}`}
                ref={el => { detailRefs.current[`${role}-${step.seq}`] = el; }}
                className={`p-4 bg-slate-900 border rounded-xl transition ${
                  isActive ? 'border-indigo-500/60 ring-1 ring-indigo-500/30' : 'border-slate-800'
                }`}
              >
                <div className="flex gap-4">
                  {/* Left rail: icon + step no. */}
                  <div className="shrink-0 flex flex-col items-center gap-1.5">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${tone.badge}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[9px] font-mono text-slate-500">STEP {step.seq}</span>
                    {step.seq < steps.length && <div className={`w-px flex-1 bg-gradient-to-b ${tone.chapter} to-transparent`} />}
                  </div>

                  {/* Right content */}
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-100">{step.title}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                          {step.module}
                        </span>
                      </div>
                      <button
                        onClick={() => onNavigateTab(step.tab)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition flex items-center gap-1"
                      >
                        <span>前往模块</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <ul className="space-y-1.5">
                      {step.paths.map((p, pi) => (
                        <li key={pi} className="flex gap-1.5 text-xs text-slate-300 leading-relaxed">
                          <ChevronRight className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${tone.icon}`} />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>

                    {step.tips && step.tips.length > 0 && (
                      <div className="space-y-1.5 pt-0.5">
                        {step.tips.map((t, ti) => (
                          <div
                            key={ti}
                            className="flex gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed"
                          >
                            <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                            <span>{t}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= Bottom Reference Grid ================= */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Keyboard shortcuts */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-indigo-400" />
            <span>快捷键速查</span>
          </h3>
          <div className="space-y-2 text-[11px]">
            {[
              { keys: ['⌘', 'K'], desc: '唤起 / 关闭命令面板（全局）' },
              { keys: ['ESC'], desc: '关闭弹窗 / 命令面板' },
              { keys: ['↑', '↓'], desc: '命令面板中切换候选' },
              { keys: ['ENTER'], desc: '选定命令面板候选项' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {item.keys.map(k => (
                    <kbd
                      key={k}
                      className="font-mono bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300 text-[10px]"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
                <span className="text-slate-400 text-right">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Admin ops cheat-sheet */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>运维小抄（管理员）</span>
          </h3>
          <div className="space-y-2 text-[11px] text-slate-300">
            <p className="text-slate-400">演示数据一键切换（幂等，可反复执行）：</p>
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px] text-emerald-300 space-y-1">
              <div>./scripts/switch-demo.sh status</div>
              <div>./scripts/switch-demo.sh full</div>
              <div>./scripts/switch-demo.sh multisource</div>
              <div>./scripts/switch-demo.sh baseline</div>
            </div>
            <p className="text-slate-400 leading-relaxed">
              前置条件：MySQL 容器（3307）与后端（8080）运行中；前端开发态运行于 5173。
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>常见问题</span>
          </h3>
          <div className="space-y-2.5">
            {FAQS.map((f, i) => (
              <div key={i} className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-200 flex gap-1.5">
                  <span className="text-cyan-400 font-mono shrink-0">Q{i + 1}</span>
                  <span>{f.q}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed pl-7">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
