import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CollectorAdapter } from '../../types/lineage';
import { LayerImportPanel } from '../LayerImportPanel';
import { collectorApi, datasourceApi } from '../../services/api';
import { useAuth, canWrite } from '../AuthGuard';
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
  Info, 
  ArrowRight,
  Layers,
  Database,
  Loader2,
  RefreshCw,
  Lock
} from 'lucide-react';

interface M10CollectorAdminProps {
  collectors: CollectorAdapter[];
}

interface CollectTask {
  id: string;
  taskName: string;
  dataSourceId: string;
  status: string;
  scheduleCron?: string | null;
  targetSchemas?: string[] | null;
  lastRunAt?: string | null;
  lastRunDuration?: number | null;
  lastRunResult?: string | null;
  totalTablesFound?: number | null;
  totalColumnsFound?: number | null;
  newAssetsRegistered?: number | null;
}

interface TaskRunState {
  running: boolean;
  percent: number;
  phase: string;
  elapsedMs: number;
  finishedStatus?: string;
}

/** Exponential backoff for run-status polling: 1s -> 2s -> 5s -> 10s (then steady). */
const POLL_DELAYS = [1000, 2000, 5000, 10000];

const formatTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace('T', ' ');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const taskBadge = (status?: string) => {
  switch (status) {
    case 'SUCCESS': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'RUNNING': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 animate-pulse';
    case 'FAILED': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    case 'PAUSED': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    default: return 'bg-slate-800 text-slate-300 border-slate-700';
  }
};

export const M10CollectorAdmin: React.FC<M10CollectorAdminProps> = ({ collectors }) => {
  const auth = useAuth();
  const writable = canWrite(auth);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'COLLECTORS' | 'LAYER_IMPORT' | 'METAMODEL'>('COLLECTORS');

  // --- Real collection pipeline: task list + async run with polled progress ---
  const [tasks, setTasks] = useState<CollectTask[]>([]);
  const [dsNames, setDsNames] = useState<Record<string, string>>({});
  const [runStates, setRunStates] = useState<Record<string, TaskRunState>>({});
  const [taskError, setTaskError] = useState<string | null>(null);
  const pollTimers = useRef<Record<string, number>>({});

  const refreshTasks = useCallback(async () => {
    try {
      const list = await collectorApi.getTasks();
      setTasks((list as CollectTask[]) || []);
    } catch {
      // backend offline: keep whatever was previously loaded
    }
  }, []);

  useEffect(() => {
    refreshTasks();
    datasourceApi.list().then((list: any[]) => {
      const map: Record<string, string> = {};
      (list || []).forEach((d: any) => { map[d.id] = d.name; });
      setDsNames(map);
    }).catch(() => {});
    const timers = pollTimers.current;
    return () => { Object.values(timers).forEach(t => window.clearTimeout(t)); };
  }, [refreshTasks]);

  const pollRunStatus = useCallback(async (taskId: string, step: number) => {
    try {
      const s = await collectorApi.getRunStatus(taskId);
      if (s.running) {
        setRunStates(prev => ({
          ...prev,
          [taskId]: {
            running: true,
            percent: s.percent ?? 0,
            phase: s.phase || '采集中…',
            elapsedMs: s.elapsedMs ?? 0,
          },
        }));
        const next = Math.min(step + 1, POLL_DELAYS.length - 1);
        pollTimers.current[taskId] = window.setTimeout(() => pollRunStatus(taskId, next), POLL_DELAYS[next]);
      } else {
        delete pollTimers.current[taskId];
        setRunStates(prev => ({
          ...prev,
          [taskId]: {
            running: false,
            percent: s.percent ?? 100,
            phase: s.phase || '采集完成',
            elapsedMs: s.elapsedMs ?? 0,
            finishedStatus: s.status,
          },
        }));
        refreshTasks();
      }
    } catch {
      // transient failure: keep backing off until the backend responds again
      const next = Math.min(step + 1, POLL_DELAYS.length - 1);
      pollTimers.current[taskId] = window.setTimeout(() => pollRunStatus(taskId, next), POLL_DELAYS[next]);
    }
  }, [refreshTasks]);

  const handleRunTask = useCallback(async (taskId: string) => {
    setTaskError(null);
    try {
      await collectorApi.runTask(taskId);
      setRunStates(prev => ({
        ...prev,
        [taskId]: { running: true, percent: 0, phase: '任务已提交，等待执行', elapsedMs: 0 },
      }));
      if (pollTimers.current[taskId]) {
        window.clearTimeout(pollTimers.current[taskId]);
      }
      pollTimers.current[taskId] = window.setTimeout(() => pollRunStatus(taskId, 0), POLL_DELAYS[0]);
      refreshTasks();
    } catch (e: any) {
      setTaskError(e?.message || '触发采集失败');
    }
  }, [pollRunStatus, refreshTasks]);

  // Local elapsed-time ticker while any run is in flight (polling backs off to 10s)
  const anyRunning = Object.values(runStates).some(s => s.running);
  useEffect(() => {
    if (!anyRunning) return;
    const timer = window.setInterval(() => {
      setRunStates(prev => {
        const next: Record<string, TaskRunState> = {};
        Object.entries(prev).forEach(([k, v]) => {
          next[k] = v.running ? { ...v, elapsedMs: v.elapsedMs + 1000 } : v;
        });
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [anyRunning]);

  // No adapter-level credential-test endpoint exists yet: surface an honest hint
  // instead of faking a connectivity success.
  const handleTestConnection = (id: string) => {
    setTestResult(prev => ({
      ...prev,
      [id]: '适配器凭据在采集运行时统一校验，请运行一次采集任务完成端到端连通性验证'
    }));
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
          {/* Real collection pipeline: trigger runs and poll live progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                采集任务（真实管道 · 异步执行 · 指数退避轮询 1s→2s→5s→10s）
              </span>
              <button
                onClick={() => refreshTasks()}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300 transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>刷新</span>
              </button>
            </div>

            {taskError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{taskError}</span>
              </div>
            )}

            {tasks.length === 0 ? (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-500 text-center">
                暂无采集任务（可在数据源管理中创建）或后端服务未连接
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {tasks.map(task => {
                  const state = runStates[task.id];
                  const running = !!state?.running;
                  const finished = state?.finishedStatus;
                  return (
                    <div key={task.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-[13px] truncate">{task.taskName}</h4>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                            {dsNames[task.dataSourceId] || (task.dataSourceId || '').slice(0, 12)}
                            {task.targetSchemas && task.targetSchemas.length > 0 ? ` ｜ ${task.targetSchemas.join(', ')}` : ''}
                          </span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border shrink-0 ${taskBadge(task.status)}`}>
                          {task.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800 text-[10px]">
                        <div>
                          <span className="text-slate-400 block">扫描表 / 列</span>
                          <span className="font-mono font-bold text-white">{task.totalTablesFound ?? 0} / {task.totalColumnsFound ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">新增资产</span>
                          <span className="font-mono font-bold text-amber-400">{task.newAssetsRegistered ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">最近运行</span>
                          <span className="font-mono font-bold text-slate-200">{formatTime(task.lastRunAt)}</span>
                        </div>
                      </div>

                      {running && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] gap-2">
                            <span className="text-indigo-300 flex items-center gap-1 min-w-0">
                              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                              <span className="truncate">{state?.phase}</span>
                            </span>
                            <span className="font-mono text-slate-400 shrink-0">
                              {state?.percent ?? 0}% · {((state?.elapsedMs ?? 0) / 1000).toFixed(1)}s
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                              style={{ width: `${state?.percent ?? 0}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {!running && finished && (
                        <div className={`p-2 rounded text-[10px] flex items-center gap-1.5 border ${
                          finished === 'SUCCESS'
                            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                        }`}>
                          {finished === 'SUCCESS'
                            ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                          <span>
                            {finished === 'SUCCESS'
                              ? `最近一次采集成功 ｜ 耗时 ${((state?.elapsedMs ?? 0) / 1000).toFixed(1)}s`
                              : '最近一次采集失败，详见运行日志'}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-0.5 gap-2">
                        <span className="text-[10px] font-mono text-slate-500 truncate">
                          {task.scheduleCron ? `CRON ${task.scheduleCron}` : '手动触发'}
                          {task.lastRunDuration != null ? ` ｜ 上次 ${task.lastRunDuration}ms` : ''}
                        </span>
                        <button
                          onClick={() => handleRunTask(task.id)}
                          disabled={running || !writable}
                          title={!writable ? '只读角色（VIEWER）无权触发采集，请以管理员身份登录' : undefined}
                          className={`px-2.5 py-1 rounded flex items-center gap-1 font-medium transition shrink-0 ${
                            running || !writable
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          }`}
                        >
                          {running ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>采集中</span>
                            </>
                          ) : !writable ? (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>只读</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              <span>立即采集</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>已注册 {collectors.length} 个采集适配器（Pull / Push / Scan 模式）：</span>
            <span className="text-emerald-400 font-mono">
              健康度均值: {collectors.length > 0
                ? `${Math.round(collectors.reduce((s, c) => s + c.healthScore, 0) / collectors.length)}%`
                : '--'}
            </span>
          </div>

          {collectors.length === 0 && (
            <div className="p-10 text-center text-xs text-slate-500 space-y-1.5 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-slate-400 font-medium">暂无采集适配器</p>
              <p className="text-[11px]">适配器运行时心跳上报后自动注册于此，可先在上方触发一次采集任务</p>
            </div>
          )}

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
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    <span>凭据测试</span>
                  </button>
                </div>

                {testResult[col.id] && (
                  <div className="p-2 bg-indigo-950/40 border border-indigo-500/30 rounded text-indigo-200 text-[11px] flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
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
