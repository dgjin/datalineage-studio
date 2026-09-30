import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Plus,
  Plug,
  Trash2,
  RefreshCw,
  Play,
  Pause,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
  Clock,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Wifi,
  WifiOff,
  Power,
  PowerOff,
  Pencil
} from 'lucide-react';
import { datasourceApi, collectorApi } from '../../services/api';

interface DataSource {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  status: string;
  sslEnabled?: boolean;
  lastTestAt?: string;
  lastTestResult?: string;
  testErrorMsg?: string;
  createdAt?: string;
}

interface CollectTask {
  id: string;
  dataSourceId: string;
  taskName: string;
  collectScope: string;
  targetSchemas?: string[];
  scheduleCron?: string;
  autoRegisterAsset?: boolean;
  autoDiscoverLineage?: boolean;
  defaultLayer?: string;
  defaultSpace?: string;
  status: string;
  lastRunAt?: string;
  lastRunDuration?: number;
  lastRunResult?: string;
  lastErrorMsg?: string;
  totalTablesFound?: number;
  totalColumnsFound?: number;
  newAssetsRegistered?: number;
}

interface RunLog {
  id: number;
  taskId: string;
  status: string;
  startTime: string;
  durationMs?: number;
  tablesScanned?: number;
  columnsScanned?: number;
  assetsCreated?: number;
  assetsUpdated?: number;
  logText?: string;
}

const DB_TYPES = ['MYSQL', 'POSTGRESQL', 'ORACLE', 'SQLSERVER', 'HIVE', 'CLICKHOUSE'];

const EMPTY_DS_FORM = {
  name: '', type: 'MYSQL', host: 'localhost', port: 3306,
  databaseName: '', username: '', password: '', sslEnabled: false,
};

const typeBadgeColor = (type: string): string => {
  switch (type) {
    case 'MYSQL': return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    case 'POSTGRESQL': return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    case 'ORACLE': return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    case 'SQLSERVER': return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
    case 'HIVE': return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'CLICKHOUSE': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    default: return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
  }
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'ACTIVE':
    case 'SUCCESS':
      return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-emerald-500/15 text-emerald-300 border-emerald-500/30"><CheckCircle2 className="w-3 h-3" />正常</span>;
    case 'RUNNING':
      return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-indigo-500/15 text-indigo-300 border-indigo-500/30"><Loader2 className="w-3 h-3 animate-spin" />运行中</span>;
    case 'FAILED':
    case 'ERROR':
      return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-rose-500/15 text-rose-300 border-rose-500/30"><XCircle className="w-3 h-3" />失败</span>;
    case 'PAUSED':
      return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/30"><Pause className="w-3 h-3" />已暂停</span>;
    case 'INACTIVE':
      return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-slate-600/20 text-slate-400 border-slate-600/40"><PowerOff className="w-3 h-3" />已停用</span>;
    default:
      return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-slate-700/40 text-slate-300 border-slate-600/40">{status}</span>;
  }
};

export const M11DataSourceManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SOURCES' | 'TASKS'>('SOURCES');
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [tasks, setTasks] = useState<CollectTask[]>([]);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test connection state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  // Create / edit data source modal
  const [showDsModal, setShowDsModal] = useState(false);
  const [editingDsId, setEditingDsId] = useState<string | null>(null);
  const [dsForm, setDsForm] = useState({ ...EMPTY_DS_FORM });
  const [dsSaving, setDsSaving] = useState(false);

  // Create task modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    dataSourceId: '', taskName: '', collectScope: 'SCHEMA_ONLY',
    targetSchemas: '', scheduleCron: '', autoRegisterAsset: true,
    autoDiscoverLineage: false, defaultLayer: 'ODS', defaultSpace: 'default',
  });
  const [taskSaving, setTaskSaving] = useState(false);

  // Run / logs
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<Record<string, any>>({});
  const [logsTaskId, setLogsTaskId] = useState<string | null>(null);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ds, tk] = await Promise.all([datasourceApi.list(), collectorApi.getTasks()]);
      setDataSources(ds || []);
      setTasks(tk || []);
      setBackendOnline(true);
    } catch (e: any) {
      setBackendOnline(false);
      setError(e?.message || '无法连接后端服务');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    setTestResults(prev => ({ ...prev, [id]: { ok: false, message: '测试中...' } }));
    try {
      const result = await datasourceApi.test(id);
      const ok = result?.success !== false;
      setTestResults(prev => ({
        ...prev,
        [id]: {
          ok,
          message: ok
            ? `连接成功 (延迟 ${result?.latency ?? '?'}, ${result?.databaseProduct ?? ''} ${result?.databaseVersion ?? ''})`
            : `失败: ${result?.error ?? '未知错误'}`
        }
      }));
      setDataSources(prev => prev.map(d => d.id === id
        ? { ...d, lastTestResult: ok ? 'SUCCESS' : 'FAILED', lastTestAt: new Date().toLocaleString() }
        : d));
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, message: `失败: ${e?.message}` } }));
    } finally {
      setTestingId(null);
    }
  };

  const openCreateDsModal = () => {
    setEditingDsId(null);
    setDsForm({ ...EMPTY_DS_FORM });
    setShowDsModal(true);
  };

  const openEditDsModal = (ds: DataSource) => {
    setEditingDsId(ds.id);
    setDsForm({
      name: ds.name,
      type: ds.type,
      host: ds.host,
      port: ds.port,
      databaseName: ds.databaseName,
      username: ds.username,
      password: '', // never prefill the secret; blank keeps the stored one
      sslEnabled: ds.sslEnabled ?? false,
    });
    setShowDsModal(true);
  };

  const closeDsModal = () => {
    setShowDsModal(false);
    setEditingDsId(null);
  };

  const handleSaveDataSource = async () => {
    if (!dsForm.name || !dsForm.host || !dsForm.databaseName || !dsForm.username) {
      alert('请填写完整的数据源信息');
      return;
    }
    setDsSaving(true);
    try {
      if (editingDsId) {
        const payload: Record<string, any> = {
          name: dsForm.name, type: dsForm.type, host: dsForm.host, port: dsForm.port,
          databaseName: dsForm.databaseName, username: dsForm.username, sslEnabled: dsForm.sslEnabled,
        };
        // Only send the password when the user typed a new one
        if (dsForm.password) payload.passwordEncrypted = dsForm.password;
        await datasourceApi.update(editingDsId, payload);
      } else {
        await datasourceApi.create({
          ...dsForm,
          passwordEncrypted: dsForm.password,
          status: 'ACTIVE',
        });
      }
      closeDsModal();
      setDsForm({ ...EMPTY_DS_FORM });
      await loadData();
    } catch (e: any) {
      alert(`${editingDsId ? '保存' : '创建'}失败: ${e?.message}`);
    } finally {
      setDsSaving(false);
    }
  };

  const handleDeleteDataSource = async (id: string, name: string) => {
    if (!confirm(`确认删除数据源「${name}」？该操作不可恢复。`)) return;
    try {
      await datasourceApi.delete(id);
      await loadData();
    } catch (e: any) {
      alert(`删除失败: ${e?.message}`);
    }
  };

  const handleToggleDsStatus = async (ds: DataSource) => {
    const disabling = ds.status !== 'INACTIVE';
    if (disabling && !confirm(`确认停用数据源「${ds.name}」？停用后其采集任务将无法运行（可随时重新启用）。`)) return;
    try {
      if (disabling) {
        await datasourceApi.disable(ds.id);
      } else {
        await datasourceApi.enable(ds.id);
      }
      await loadData();
    } catch (e: any) {
      alert(`${disabling ? '停用' : '启用'}失败: ${e?.message}`);
    }
  };

  const handleRunTask = async (id: string) => {
    setRunningId(id);
    try {
      const result = await collectorApi.runTask(id);
      setRunResult(prev => ({ ...prev, [id]: result }));
      await loadData();
      // Ask the app shell to reload assets / edges / changes so the collected
      // metadata shows up in the lineage and governance modules immediately.
      if (result?.success !== false) {
        window.dispatchEvent(new Event('lineage:refresh'));
      }
    } catch (e: any) {
      setRunResult(prev => ({ ...prev, [id]: { success: false, error: e?.message } }));
    } finally {
      setRunningId(null);
    }
  };

  const handleTogglePause = async (task: CollectTask) => {
    try {
      if (task.status === 'PAUSED') {
        await collectorApi.resumeTask(task.id);
      } else {
        await collectorApi.pauseTask(task.id);
      }
      await loadData();
    } catch (e: any) {
      alert(`操作失败: ${e?.message}`);
    }
  };

  const handleCreateTask = async () => {
    if (!taskForm.dataSourceId || !taskForm.taskName) {
      alert('请选择数据源并填写任务名称');
      return;
    }
    setTaskSaving(true);
    try {
      await collectorApi.createTask({
        ...taskForm,
        targetSchemas: taskForm.targetSchemas
          ? taskForm.targetSchemas.split(',').map(s => s.trim()).filter(Boolean)
          : [],
      });
      setShowTaskModal(false);
      setTaskForm({
        dataSourceId: '', taskName: '', collectScope: 'SCHEMA_ONLY',
        targetSchemas: '', scheduleCron: '', autoRegisterAsset: true,
        autoDiscoverLineage: false, defaultLayer: 'ODS', defaultSpace: 'default',
      });
      await loadData();
    } catch (e: any) {
      alert(`创建失败: ${e?.message}`);
    } finally {
      setTaskSaving(false);
    }
  };

  const handleViewLogs = async (taskId: string) => {
    if (logsTaskId === taskId) {
      setLogsTaskId(null);
      return;
    }
    setLogsTaskId(taskId);
    setLogsLoading(true);
    try {
      const result = await collectorApi.getTaskLogs(taskId, 10);
      setLogs(result || []);
    } catch (e: any) {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const dsName = (id: string) => dataSources.find(d => d.id === id)?.name || id;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" />
            <span>M11 数据源与元数据采集管理</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            配置外部数据源 → 自动采集元数据 → 自动注册资产（新增表/字段变更自动发现）
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Backend status indicator */}
          {backendOnline === true && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded">
              <Wifi className="w-3 h-3" />后端已连接
            </span>
          )}
          {backendOnline === false && (
            <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-1 rounded">
              <WifiOff className="w-3 h-3" />后端未连接
            </span>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-900 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {/* Backend offline notice */}
      {backendOnline === false && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 space-y-1">
            <p className="font-semibold">后端服务未连接（{error}）</p>
            <p>请启动 Spring Boot 后端与 MySQL，然后刷新页面：</p>
            <pre className="text-[11px] font-mono bg-slate-900/80 border border-slate-800 rounded p-2 mt-1 text-slate-300">
{`# 方式一：Docker Compose
docker-compose up -d mysql backend

# 方式二：本地开发
cd backend && ./start.sh`}
            </pre>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs w-fit">
        <button
          onClick={() => setActiveTab('SOURCES')}
          className={`px-3 py-1.5 rounded-md font-medium transition ${activeTab === 'SOURCES' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          数据源管理 ({dataSources.length})
        </button>
        <button
          onClick={() => setActiveTab('TASKS')}
          className={`px-3 py-1.5 rounded-md font-medium transition ${activeTab === 'TASKS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          采集任务 ({tasks.length})
        </button>
      </div>

      {/* ============ Data Sources Tab ============ */}
      {activeTab === 'SOURCES' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openCreateDsModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
            >
              <Plus className="w-3.5 h-3.5" />
              新建数据源
            </button>
          </div>

          {dataSources.length === 0 && backendOnline !== false && (
            <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
              <Server className="w-10 h-10 mx-auto mb-3 opacity-40" />
              暂无数据源，点击「新建数据源」开始接入
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {dataSources.map(ds => {
              const test = testResults[ds.id];
              return (
                <div key={ds.id} className={`rounded-xl border bg-slate-900/60 p-4 space-y-3 transition ${
                  ds.status === 'INACTIVE' ? 'border-slate-800/60 opacity-75' : 'border-slate-800 hover:border-slate-700'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <HardDrive className="w-4.5 h-4.5 text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-white truncate">{ds.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {ds.host}:{ds.port}/{ds.databaseName}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${typeBadgeColor(ds.type)}`}>
                        {ds.type}
                      </span>
                      {statusBadge(ds.status)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span>用户: <span className="font-mono text-slate-300">{ds.username}</span></span>
                    {ds.lastTestAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        最后测试: {ds.lastTestAt}
                      </span>
                    )}
                  </div>

                  {test && (
                    <div className={`text-[11px] px-2.5 py-1.5 rounded-lg border font-mono ${
                      test.ok
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}>
                      {test.ok ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}
                      {test.message}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleTestConnection(ds.id)}
                      disabled={testingId === ds.id || ds.status === 'INACTIVE'}
                      title={ds.status === 'INACTIVE' ? '数据源已停用，启用后可测试连接' : ''}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
                    >
                      {testingId === ds.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Plug className="w-3 h-3" />}
                      测试连接
                    </button>
                    <button
                      onClick={() => openEditDsModal(ds)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                    >
                      <Pencil className="w-3 h-3" />
                      编辑
                    </button>
                    <button
                      onClick={() => handleToggleDsStatus(ds)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md border transition ${
                        ds.status === 'INACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-amber-500/10 hover:border-amber-500/30'
                      }`}
                    >
                      {ds.status === 'INACTIVE' ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                      {ds.status === 'INACTIVE' ? '启用' : '停用'}
                    </button>
                    <button
                      onClick={() => handleDeleteDataSource(ds.id, ds.name)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ Collect Tasks Tab ============ */}
      {activeTab === 'TASKS' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowTaskModal(true)}
              disabled={dataSources.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition disabled:opacity-40"
              title={dataSources.length === 0 ? '请先创建数据源' : ''}
            >
              <Plus className="w-3.5 h-3.5" />
              创建采集任务
            </button>
          </div>

          {tasks.length === 0 && backendOnline !== false && (
            <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
              <Play className="w-10 h-10 mx-auto mb-3 opacity-40" />
              暂无采集任务，先创建数据源，再配置定时采集任务
            </div>
          )}

          <div className="space-y-3">
            {tasks.map(task => {
              const result = runResult[task.id];
              return (
                <div key={task.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-white flex items-center gap-2">
                        <Play className="w-3.5 h-3.5 text-indigo-400" />
                        {task.taskName}
                        {statusBadge(task.status)}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 space-x-3">
                        <span>数据源: <span className="text-slate-300">{dsName(task.dataSourceId)}</span>{dataSources.find(d => d.id === task.dataSourceId)?.status === 'INACTIVE' && <span className="text-[10px] text-amber-400 ml-1">(已停用)</span>}</span>
                        <span>范围: <span className="font-mono text-slate-300">{task.collectScope}</span></span>
                        {task.scheduleCron && (
                          <span>Cron: <span className="font-mono text-slate-300">{task.scheduleCron}</span></span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRunTask(task.id)}
                        disabled={runningId === task.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
                      >
                        {runningId === task.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Play className="w-3 h-3" />}
                        立即执行
                      </button>
                      <button
                        onClick={() => handleTogglePause(task)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                      >
                        {task.status === 'PAUSED' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                        {task.status === 'PAUSED' ? '恢复' : '暂停'}
                      </button>
                      <button
                        onClick={() => handleViewLogs(task.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                      >
                        <FileText className="w-3 h-3" />
                        日志
                      </button>
                    </div>
                  </div>

                  {/* Task stats */}
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500">发现表</div>
                      <div className="text-sm font-mono text-slate-200">{task.totalTablesFound ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500">发现字段</div>
                      <div className="text-sm font-mono text-slate-200">{task.totalColumnsFound ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500">新增资产</div>
                      <div className="text-sm font-mono text-emerald-400">{task.newAssetsRegistered ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-500">最后运行</div>
                      <div className="text-[11px] font-mono text-slate-300 truncate">
                        {task.lastRunAt || '未运行'}
                      </div>
                    </div>
                  </div>

                  {task.lastErrorMsg && (
                    <div className="text-[11px] px-2.5 py-1.5 rounded-lg border bg-rose-500/10 border-rose-500/30 text-rose-300 font-mono">
                      {task.lastErrorMsg}
                    </div>
                  )}

                  {result && (
                    <div className={`text-[11px] px-2.5 py-1.5 rounded-lg border font-mono ${
                      result.success !== false
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}>
                      {result.success !== false
                        ? `采集完成：扫描表 ${result.tablesFound ?? 0}，字段 ${result.columnsFound ?? 0}，新增资产 ${result.assetsCreated ?? 0}，更新 ${result.assetsUpdated ?? 0}，发现血缘 ${result.edgesDiscovered ?? 0}，变更 ${result.changesDetected ?? 0}，耗时 ${result.durationMs ?? 0}ms`
                        : `采集失败: ${result.error ?? '未知错误'}`}
                    </div>
                  )}

                  {/* Run logs */}
                  {logsTaskId === task.id && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-400">最近运行日志</div>
                      {logsLoading ? (
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />加载中...
                        </div>
                      ) : logs.length === 0 ? (
                        <div className="text-[11px] text-slate-500">暂无运行记录</div>
                      ) : (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto">
                          {logs.map(log => (
                            <div key={log.id} className="text-[11px] font-mono flex items-center gap-2 text-slate-300 border-b border-slate-800/60 pb-1.5">
                              <span className="text-slate-500">{log.startTime}</span>
                              <span className={`px-1.5 rounded border ${
                                log.status === 'SUCCESS'
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                              }`}>{log.status}</span>
                              <span>表 {log.tablesScanned ?? 0} / 字段 {log.columnsScanned ?? 0} / 新增 {log.assetsCreated ?? 0}</span>
                              <span className="text-slate-500">{log.durationMs ?? 0}ms</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ Create / Edit Data Source Modal ============ */}
      {showDsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {editingDsId ? <Pencil className="w-4 h-4 text-indigo-400" /> : <Database className="w-4 h-4 text-indigo-400" />}
                {editingDsId ? '编辑数据源' : '新建数据源'}
              </h3>
              <button onClick={closeDsModal} className="text-slate-400 hover:text-slate-200 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-1">
                  <label className="block text-slate-400 mb-1">名称 *</label>
                  <input
                    value={dsForm.name}
                    onChange={e => setDsForm({ ...dsForm, name: e.target.value })}
                    placeholder="CRM 生产库"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-slate-400 mb-1">类型 *</label>
                  <select
                    value={dsForm.type}
                    onChange={e => setDsForm({ ...dsForm, type: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {DB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-slate-400 mb-1">Host *</label>
                  <input
                    value={dsForm.host}
                    onChange={e => setDsForm({ ...dsForm, host: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-slate-400 mb-1">端口 *</label>
                  <input
                    type="number"
                    value={dsForm.port}
                    onChange={e => setDsForm({ ...dsForm, port: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-slate-400 mb-1">数据库名 *</label>
                  <input
                    value={dsForm.databaseName}
                    onChange={e => setDsForm({ ...dsForm, databaseName: e.target.value })}
                    placeholder="crm_prod"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-slate-400 mb-1">用户名 *</label>
                  <input
                    value={dsForm.username}
                    onChange={e => setDsForm({ ...dsForm, username: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-slate-400 mb-1">
                    密码{editingDsId && <span className="text-slate-500 font-normal">（留空则不修改）</span>}
                  </label>
                  <input
                    type="password"
                    value={dsForm.password}
                    onChange={e => setDsForm({ ...dsForm, password: e.target.value })}
                    placeholder={editingDsId ? '••••••••（保持不变）' : ''}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-1 flex items-end pb-1.5">
                  <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dsForm.sslEnabled}
                      onChange={e => setDsForm({ ...dsForm, sslEnabled: e.target.checked })}
                      className="accent-indigo-500"
                    />
                    启用 SSL
                  </label>
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                密码将使用 Jasypt 加密后存储（password_encrypted），不会以明文落库。
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-800">
              <button
                onClick={closeDsModal}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
              >
                取消
              </button>
              <button
                onClick={handleSaveDataSource}
                disabled={dsSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition disabled:opacity-50"
              >
                {dsSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                {editingDsId ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ Create Collect Task Modal ============ */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-indigo-400" />
                创建采集任务
              </h3>
              <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-slate-200 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">数据源 *</label>
                <select
                  value={taskForm.dataSourceId}
                  onChange={e => setTaskForm({ ...taskForm, dataSourceId: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">请选择数据源</option>
                  {dataSources.map(ds => (
                    <option key={ds.id} value={ds.id} disabled={ds.status === 'INACTIVE'}>
                      {ds.name} ({ds.type}){ds.status === 'INACTIVE' ? ' — 已停用' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">任务名称 *</label>
                <input
                  value={taskForm.taskName}
                  onChange={e => setTaskForm({ ...taskForm, taskName: e.target.value })}
                  placeholder="CRM Schema 每日同步"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">采集范围</label>
                  <select
                    value={taskForm.collectScope}
                    onChange={e => setTaskForm({ ...taskForm, collectScope: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="SCHEMA_ONLY">SCHEMA_ONLY（仅结构）</option>
                    <option value="INCREMENTAL">INCREMENTAL（增量）</option>
                    <option value="FULL">FULL（全量）</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">定时 Cron（可选）</label>
                  <input
                    value={taskForm.scheduleCron}
                    onChange={e => setTaskForm({ ...taskForm, scheduleCron: e.target.value })}
                    placeholder="0 0 2 * * ?"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">目标 Schema（逗号分隔）</label>
                  <input
                    value={taskForm.targetSchemas}
                    onChange={e => setTaskForm({ ...taskForm, targetSchemas: e.target.value })}
                    placeholder="crm_prod, crm_ods"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">默认数仓层级</label>
                  <select
                    value={taskForm.defaultLayer}
                    onChange={e => setTaskForm({ ...taskForm, defaultLayer: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {['ODS', 'DWD', 'DWS', 'ADS', 'APP'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">默认数据域</label>
                  <input
                    value={taskForm.defaultSpace}
                    onChange={e => setTaskForm({ ...taskForm, defaultSpace: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col justify-end gap-1.5 pb-0.5">
                  <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taskForm.autoRegisterAsset}
                      onChange={e => setTaskForm({ ...taskForm, autoRegisterAsset: e.target.checked })}
                      className="accent-indigo-500"
                    />
                    自动注册资产
                  </label>
                  <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taskForm.autoDiscoverLineage}
                      onChange={e => setTaskForm({ ...taskForm, autoDiscoverLineage: e.target.checked })}
                      className="accent-indigo-500"
                    />
                    自动发现血缘
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-800">
              <button
                onClick={() => setShowTaskModal(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
              >
                取消
              </button>
              <button
                onClick={handleCreateTask}
                disabled={taskSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition disabled:opacity-50"
              >
                {taskSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
