import React, { useCallback, useEffect, useState } from 'react';
import {
  Home,
  Database,
  GitFork,
  AlertOctagon,
  Activity,
  Binary,
  FileCheck2,
  ShieldAlert,
  Inbox,
  BarChart3,
  Cpu,
  Server,
  BookOpen,
  LifeBuoy,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { APP_VERSION } from '../utils/appVersion';

export type NavTab =
  | 'workbench'
  | 'catalog'
  | 'lineage'
  | 'impact'
  | 'changes'
  | 'metrics'
  | 'contracts'
  | 'validation'
  | 'inbox'
  | 'dashboard'
  | 'collectors'
  | 'datasources'
  | 'standards'
  | 'models'
  | 'help';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unmanagedCount: number;
  pendingAckCount: number;
  ruleFailureCount: number;
  metricsCount: number;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: LucideIcon;
  badge: string | null;
  badgeColor?: string;
  /** Status dot shown in rail mode for dynamic (alert) badges only */
  dotColor?: string;
}

const SIDEBAR_STORAGE_KEY = 'dl_sidebar_collapsed';

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  unmanagedCount,
  pendingAckCount,
  ruleFailureCount,
  metricsCount
}) => {
  // Icon-rail collapse state, persisted so a reload keeps the layout
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'; } catch { return false; }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  // Rail-mode tooltip: floats next to the hovered/focused icon. Rendered with
  // position:fixed so the scrollable nav's overflow never clips it.
  const [tip, setTip] = useState<{ label: string; badge: string | null; top: number; left: number } | null>(null);

  const showTip = (
    item: NavItem,
    e: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>
  ) => {
    if (!collapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTip({ label: item.label, badge: item.badge, top: rect.top + rect.height / 2, left: rect.right + 16 });
  };
  const hideTip = () => setTip(null);

  // Drop the tooltip whenever the rail expands or the nav scrolls
  useEffect(() => { setTip(null); }, [collapsed]);

  // Cmd/Ctrl+B toggles the rail (VS Code convention)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleCollapsed]);

  const mainNav: NavItem[] = [
    { id: 'workbench', label: '工作台', icon: Home, badge: null },
    { id: 'catalog', label: 'M1 资产目录', icon: Database, badge: null },
    { id: 'lineage', label: 'M2 血缘探索器', icon: GitFork, badge: '核心' },
    { id: 'impact', label: 'M3 影响分析', icon: AlertOctagon, badge: pendingAckCount > 0 ? `${pendingAckCount}待确认` : null, badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30', dotColor: 'bg-amber-400' },
    { id: 'changes', label: 'M4 变更中心', icon: Activity, badge: unmanagedCount > 0 ? `${unmanagedCount}暗改` : null, badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30', dotColor: 'bg-rose-400' },
    { id: 'metrics', label: 'M5 指标中心', icon: Binary, badge: metricsCount > 0 ? `${metricsCount}项` : null },
    { id: 'contracts', label: 'M6 契约建模', icon: FileCheck2, badge: null },
    { id: 'validation', label: 'M7 校验中心', icon: ShieldAlert, badge: ruleFailureCount > 0 ? `${ruleFailureCount}项告警` : null, badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30', dotColor: 'bg-amber-400' },
    { id: 'inbox', label: 'M8 通知中心', icon: Inbox, badge: pendingAckCount > 0 ? String(pendingAckCount) : null, dotColor: 'bg-indigo-400' },
    { id: 'dashboard', label: 'M9 运营看板', icon: BarChart3, badge: null },
    { id: 'collectors', label: 'M10 采集与管理', icon: Cpu, badge: null },
    { id: 'datasources', label: 'M11 数据源接入', icon: Server, badge: 'New', badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    { id: 'standards', label: 'M12 标准中枢', icon: BookOpen, badge: 'New', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    { id: 'models', label: 'M13 数据模型', icon: Database, badge: 'New', badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
    { id: 'help', label: '帮助中心', icon: LifeBuoy, badge: '指南', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  ];

  return (
    <aside className={`${collapsed ? 'w-14' : 'w-56'} border-r border-slate-800 bg-slate-950/80 flex flex-col shrink-0 select-none transition-[width] duration-300 ease-in-out`}>
      {/* Rail header: section title + collapse toggle (title hides in rail mode) */}
      <div className={`flex items-center h-11 shrink-0 ${collapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
        <span className={`text-[11px] font-semibold text-slate-400 tracking-wider uppercase overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out ${
          collapsed ? 'max-w-0 opacity-0' : 'max-w-[140px] opacity-100'
        }`}>
          功能架构导航
        </span>
        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800/70 transition shrink-0"
          title={collapsed ? '展开侧边栏 (⌘B)' : '收起侧边栏 (⌘B)'}
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>
      </div>

      <nav className="flex-1 px-2 space-y-1 overflow-y-auto overflow-x-hidden" onScroll={hideTip}>
        {mainNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              onMouseEnter={(e) => showTip(item, e)}
              onMouseLeave={hideTip}
              onFocus={(e) => showTip(item, e)}
              onBlur={hideTip}
              className={`relative w-full flex items-center py-2 rounded-lg text-xs font-medium transition group ${
                collapsed ? 'justify-center px-0' : 'justify-between px-2.5'
              } ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className={`flex items-center min-w-0 ${collapsed ? '' : 'gap-2.5'}`}>
                <Icon className={`w-4 h-4 shrink-0 transition ${
                  isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'
                }`} />
                <span className={`truncate whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out ${
                  collapsed ? 'max-w-0 opacity-0' : 'max-w-[130px] opacity-100'
                }`}>{item.label}</span>
              </div>

              {!collapsed && item.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${
                  item.badgeColor || (isActive ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-800 text-slate-400 border-slate-700')
                }`}>
                  {item.badge}
                </span>
              )}

              {/* Rail mode: dynamic badges compress into a small status dot */}
              {collapsed && item.badge && item.dotColor && (
                <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${item.dotColor}`} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Mini Status */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        {collapsed ? (
          <div className="flex justify-center py-1" title="三速同步引擎 · T0~T2 正常">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>三速同步引擎</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">T0~T2 正常</span>
            </div>
            <div className="text-[10px] text-slate-400" title={`提交 ${APP_VERSION.commit} · 分支 ${APP_VERSION.branch}`}>
              图谱版本: <span className="text-slate-400 font-mono">{APP_VERSION.version}</span>
            </div>
          </div>
        )}
      </div>

      {/* Rail-mode icon tooltip bubble */}
      {collapsed && tip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ top: tip.top, left: tip.left }}
          role="tooltip"
        >
          <div className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-800 border border-slate-700 shadow-xl shadow-slate-950/50 text-xs text-slate-100 whitespace-nowrap animate-[rail-tooltip-in_150ms_ease-out_both]">
            <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-800 border-l border-b border-slate-700 rotate-45" />
            <span className="relative">{tip.label}</span>
            {tip.badge && (
              <span className="relative text-[10px] px-1 py-0.5 rounded bg-slate-700/80 text-slate-300 font-mono">{tip.badge}</span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
