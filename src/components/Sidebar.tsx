import React from 'react';
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
  Flame,
  ChevronRight,
  LifeBuoy
} from 'lucide-react';

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
  | 'help';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unmanagedCount: number;
  pendingAckCount: number;
  ruleFailureCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  unmanagedCount,
  pendingAckCount,
  ruleFailureCount
}) => {
  const mainNav = [
    { id: 'workbench' as NavTab, label: '工作台', icon: Home, badge: null },
    { id: 'catalog' as NavTab, label: 'M1 资产目录', icon: Database, badge: null },
    { id: 'lineage' as NavTab, label: 'M2 血缘探索器', icon: GitFork, badge: '核心' },
    { id: 'impact' as NavTab, label: 'M3 影响分析', icon: AlertOctagon, badge: pendingAckCount > 0 ? `${pendingAckCount}待确认` : null, badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    { id: 'changes' as NavTab, label: 'M4 变更中心', icon: Activity, badge: unmanagedCount > 0 ? `${unmanagedCount}暗改` : null, badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    { id: 'metrics' as NavTab, label: 'M5 指标中心', icon: Binary, badge: '178项' },
    { id: 'contracts' as NavTab, label: 'M6 契约建模', icon: FileCheck2, badge: null },
    { id: 'validation' as NavTab, label: 'M7 校验中心', icon: ShieldAlert, badge: ruleFailureCount > 0 ? `${ruleFailureCount}项告警` : null, badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    { id: 'inbox' as NavTab, label: 'M8 通知中心', icon: Inbox, badge: pendingAckCount > 0 ? String(pendingAckCount) : null },
    { id: 'dashboard' as NavTab, label: 'M9 运营看板', icon: BarChart3, badge: null },
    { id: 'collectors' as NavTab, label: 'M10 采集与管理', icon: Cpu, badge: null },
    { id: 'datasources' as NavTab, label: 'M11 数据源接入', icon: Server, badge: 'New', badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    { id: 'standards' as NavTab, label: 'M12 标准中枢', icon: BookOpen, badge: 'New', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    { id: 'help' as NavTab, label: '帮助中心', icon: LifeBuoy, badge: '指南', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  ];

  return (
    <aside className="w-56 border-r border-slate-800 bg-slate-950/80 flex flex-col shrink-0 select-none">
      <div className="p-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
        功能架构导航
      </div>
      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        {mainNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition group ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 transition ${
                  isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'
                }`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${
                  item.badgeColor || (isActive ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-800 text-slate-400 border-slate-700')
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Mini Status */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span>三速同步引擎</span>
          </span>
          <span className="text-[10px] text-emerald-400 font-mono">T0~T2 正常</span>
        </div>
        <div className="text-[10px] text-slate-400">
          图谱版本: <span className="text-slate-400 font-mono">v2026.09-bi</span>
        </div>
      </div>
    </aside>
  );
};
