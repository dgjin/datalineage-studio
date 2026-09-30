import React, { useState } from 'react';
import { NotificationItem } from '../../types/lineage';
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
  ArrowRight
} from 'lucide-react';

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

        <button
          onClick={onMarkAllRead}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition"
        >
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>全部标记为已读</span>
        </button>
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

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80 pl-4">
                {n.actions.map((act, i) => (
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
            </div>
          ))
        )}
      </div>
    </div>
  );
};
