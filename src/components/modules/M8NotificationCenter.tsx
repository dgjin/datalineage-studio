import React, { useEffect, useState } from 'react';
import { NotificationItem } from '../../types/lineage';
import { webhookApi } from '../../services/api';
import { 
  Inbox, 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  Sliders, 
  Check, 
  Sparkles,
  ArrowRight,
  Webhook,
  Plus,
  Trash2,
  Pencil,
  Send,
  X,
  Loader2,
} from 'lucide-react';

const WEBHOOK_EVENTS = [
  { key: 'change.created', label: '变更创建' },
  { key: 'approval.decided', label: '审批决策' },
  { key: 'standard.violation', label: '标准违规' },
];

interface M8NotificationCenterProps {
  notifications: NotificationItem[];
  onActionClick: (notif: NotificationItem, actionKey: string) => void;
  onMarkAllRead: () => void;
}

export const M8NotificationCenter: React.FC<M8NotificationCenterProps> = ({
  notifications,
  onActionClick,
  onMarkAllRead
}) => {
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'ACTIONABLE'>('ALL');
  const [dedupEnabled, setDedupEnabled] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);

  // ---- Webhook subscription management (external CI/CD notifications) ----
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>(['change.created', 'approval.decided']);
  const [formSecret, setFormSecret] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const loadWebhooks = async () => {
    setWebhookLoading(true);
    try {
      setWebhooks((await webhookApi.list()) as any[]);
      setWebhookError(null);
    } catch (e: any) {
      setWebhookError(e?.message || '加载 Webhook 配置失败');
    } finally {
      setWebhookLoading(false);
    }
  };

  useEffect(() => {
    if (webhookModalOpen) loadWebhooks();
  }, [webhookModalOpen]);

  const resetWebhookForm = () => {
    setEditingId(null);
    setFormName('');
    setFormUrl('');
    setFormEvents(['change.created', 'approval.decided']);
    setFormSecret('');
    setFormEnabled(true);
  };

  const openWebhookEdit = (w: any) => {
    setEditingId(w.id);
    setFormName(w.name || '');
    setFormUrl(w.url || '');
    setFormEvents(Array.isArray(w.events) ? w.events : []);
    setFormSecret(w.secret || '');
    setFormEnabled(!!w.enabled);
  };

  const saveWebhook = async () => {
    if (!formName.trim() || !formUrl.trim()) {
      setWebhookError('名称与回调 URL 必填');
      return;
    }
    try {
      const payload = { name: formName.trim(), url: formUrl.trim(), events: formEvents, enabled: formEnabled, secret: formSecret };
      if (editingId) {
        await webhookApi.update(editingId, payload);
      } else {
        await webhookApi.create(payload);
      }
      resetWebhookForm();
      await loadWebhooks();
    } catch (e: any) {
      setWebhookError(e?.message || '保存失败');
    }
  };

  const removeWebhook = async (id: string) => {
    try {
      await webhookApi.remove(id);
      if (editingId === id) resetWebhookForm();
      await loadWebhooks();
    } catch (e: any) {
      setWebhookError(e?.message || '删除失败');
    }
  };

  const testWebhook = async (id: string) => {
    setTestResults((p) => ({ ...p, [id]: '发送中…' }));
    try {
      const r: any = await webhookApi.test(id);
      const detail = r?.error || (r?.statusCode ? `HTTP ${r.statusCode}` : '无法连接目标地址');
      setTestResults((p) => ({ ...p, [id]: r?.success ? `✓ 投递成功 (${detail})` : `✗ 投递失败 (${detail})` }));
    } catch (e: any) {
      setTestResults((p) => ({ ...p, [id]: `✗ 投递失败 (${e?.message || '网络错误'})` }));
    }
  };

  const filteredNotifs = notifications.filter(n => {
    if (filter === 'UNREAD') return !n.read;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Inbox className="w-5 h-5 text-indigo-400" />
            <span>M8 协同通知与闭环中心 (Actionable Inbox)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            拒绝信息过载：内置降噪五规则，所有通知均附带就地操作按钮 (In-place Actions) 推进治理闭环
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWebhookModalOpen(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 transition"
          >
            <Webhook className="w-3.5 h-3.5" />
            <span>Webhook 配置</span>
          </button>
          <button
            onClick={onMarkAllRead}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>全部标记为已读</span>
          </button>
        </div>
      </div>

      {/* Noise Reduction Configuration Card */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>智能降噪与防疲劳偏好 (Anti-Noise Rules)</span>
          </span>
          <span className="text-[11px] text-emerald-400 font-mono">全局生效中</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-200 font-medium block">同一 ChangeSet 智能合并</span>
              <span className="text-[10px] text-slate-400">单次 MR 中多列变更聚合为 1 条推送</span>
            </div>
            <input 
              type="checkbox" 
              checked={dedupEnabled} 
              onChange={() => setDedupEnabled(!dedupEnabled)}
              className="accent-indigo-600 w-4 h-4 cursor-pointer" 
            />
          </div>

          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-200 font-medium block">夜间静默与周报归集</span>
              <span className="text-[10px] text-slate-400">非 P0 阻断告警自动汇入次日晨报</span>
            </div>
            <input 
              type="checkbox" 
              checked={quietHoursEnabled} 
              onChange={() => setQuietHoursEnabled(!quietHoursEnabled)}
              className="accent-indigo-600 w-4 h-4 cursor-pointer" 
            />
          </div>

          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-200 font-medium block">破坏性变更实时直达</span>
              <span className="text-[10px] text-rose-400">强制企业微信/飞书/邮件弹窗</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">不可关闭</span>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            所有事项均已处理完毕，暂无待办通知！
          </div>
        ) : (
          filteredNotifs.map(n => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border transition space-y-3 text-xs ${
                n.severity === 'CRITICAL'
                  ? 'bg-rose-950/20 border-rose-500/40'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${n.read ? 'bg-slate-600' : 'bg-rose-500'}`} />
                  <h3 className="font-bold text-white text-sm">{n.title}</h3>
                </div>
                <span className="font-mono text-[10px] text-slate-400">{n.timestamp}</span>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed pl-4">
                {n.body}
              </p>

              {/* Action Buttons (API-sourced notifications may carry no actions) */}
              {(n.actions?.length ?? 0) > 0 && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80 pl-4">
                  {n.actions!.map((act, i) => (
                    <button
                      key={i}
                      onClick={() => onActionClick(n, act.action)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        act.variant === 'primary'
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          : act.variant === 'danger'
                          ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Webhook Subscription Modal (external CI/CD change notifications) */}
      {webhookModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 space-y-4 text-xs max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-cyan-400" />
                  <span>Webhook 订阅配置（CI/CD 变更通知）</span>
                </h3>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  变更创建 / 审批决策 / 标准违规事件将携带 HMAC-SHA256 签名实时推送至外部流水线
                </p>
              </div>
              <button onClick={() => setWebhookModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {webhookError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">
                {webhookError}
              </div>
            )}

            {/* Existing subscriptions */}
            <div className="space-y-2 overflow-y-auto">
              {webhookLoading ? (
                <div className="text-center text-slate-500 py-4 text-[11px]">加载中…</div>
              ) : webhooks.length === 0 ? (
                <div className="text-center text-slate-500 py-4 text-[11px]">暂无订阅配置，请在下方创建</div>
              ) : (
                webhooks.map((w) => (
                  <div key={w.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${w.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                        <span className="font-semibold text-white truncate">{w.name}</span>
                        <span className="font-mono text-[10px] text-slate-400 truncate max-w-[220px]">{w.url}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => testWebhook(w.id)}
                          className="px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 transition"
                        >
                          <Send className="w-3 h-3" />
                          <span>测试</span>
                        </button>
                        <button
                          onClick={() => openWebhookEdit(w)}
                          className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 transition"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeWebhook(w.id)}
                          className="px-2 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(w.events || []).map((ev: string) => (
                        <span key={ev} className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-mono text-[10px]">
                          {ev}
                        </span>
                      ))}
                      {(!w.events || w.events.length === 0) && (
                        <span className="text-[10px] text-slate-500">订阅全部事件</span>
                      )}
                    </div>
                    {testResults[w.id] && (
                      <div className={`font-mono text-[10px] ${testResults[w.id].startsWith('✓') ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {testResults[w.id]}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Create / edit form */}
            <div className="border-t border-slate-800 pt-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{editingId ? '编辑订阅' : '新建订阅'}</span>
                </span>
                {editingId && (
                  <button onClick={resetWebhookForm} className="text-[11px] text-slate-400 hover:text-white">
                    取消编辑，切换新建
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="订阅名称，如：GitLab CI 流水线"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
                />
                <input
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://ci.example.com/hooks/datalineage"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-slate-400">订阅事件：</span>
                {WEBHOOK_EVENTS.map((ev) => (
                  <label key={ev.key} className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={formEvents.includes(ev.key)}
                      onChange={() =>
                        setFormEvents((prev) =>
                          prev.includes(ev.key) ? prev.filter((k) => k !== ev.key) : [...prev, ev.key]
                        )
                      }
                      className="accent-cyan-600 w-3.5 h-3.5"
                    />
                    <span className="font-mono text-[10px]">{ev.key}</span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                <input
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                  placeholder="签名密钥（可空，回填 ****** 表示保持不变）"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
                />
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={formEnabled}
                    onChange={() => setFormEnabled(!formEnabled)}
                    className="accent-cyan-600 w-3.5 h-3.5"
                  />
                  <span>启用订阅</span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={saveWebhook}
                  disabled={webhookLoading}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {webhookLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{editingId ? '保存修改' : '创建订阅'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
