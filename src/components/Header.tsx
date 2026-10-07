import React, { useState } from 'react';
import { 
  Network, 
  Search, 
  Bell, 
  Layers, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  UserCheck, 
  AlertTriangle,
  FileCode2,
  Sliders,
  CheckCircle2,
  ChevronDown,
  LogOut,
  FlaskConical
} from 'lucide-react';
import { UserRole, NotificationItem } from '../types/lineage';
import { ROLE_LABELS } from './AuthGuard';
import type { AuthUser } from '../services/api';

interface HeaderProps {
  currentSpace: string;
  onSpaceChange: (space: string) => void;
  currentUserRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onOpenCommandPalette: () => void;
  isTimeTravelActive: boolean;
  onToggleTimeTravel: () => void;
  timeTravelDate: string;
  onTimeTravelDateChange?: (date: string) => void;
  notifications: NotificationItem[];
  onOpenNotifications: () => void;
  onOpenDesignDoc: () => void;
  demoMode: boolean;
  onToggleDemoMode: () => void;
  authUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSpace,
  onSpaceChange,
  currentUserRole,
  onRoleChange,
  onOpenCommandPalette,
  isTimeTravelActive,
  onToggleTimeTravel,
  timeTravelDate,
  onTimeTravelDateChange,
  notifications,
  onOpenNotifications,
  onOpenDesignDoc,
  demoMode,
  onToggleDemoMode,
  authUser,
  onLogout
}) => {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const roleLabels: Record<UserRole, { title: string; color: string }> = {
    ARCHITECT: { title: '数据架构师', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    ENGINEER: { title: '数据工程师', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    METRIC_OWNER: { title: '指标 Owner', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    ANALYST: { title: '分析师 / 业务用户', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    GOVERNANCE_ADMIN: { title: '治理管理员', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    PLATFORM_ADMIN: { title: '平台管理员', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' }
  };

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-4 flex items-center justify-between">
      {/* Brand & Space Switcher */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
              <Network className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white">DataLineage</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Studio</span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">通用数据血缘与变更治理平台</p>
          </div>
        </div>

        {/* Space Selector */}
        <div className="h-5 w-px bg-slate-800 hidden md:block" />
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950/60 border border-slate-800 rounded-md px-2 py-1">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">数据域空间:</span>
          <select 
            value={currentSpace} 
            onChange={(e) => onSpaceChange(e.target.value)}
            className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-slate-900 text-white">全域视角 (All Spaces)</option>
            <option value="crm" className="bg-slate-900 text-white">CRM 客户域 (crm)</option>
            <option value="trade" className="bg-slate-900 text-white">交易结算域 (trade)</option>
            <option value="risk" className="bg-slate-900 text-white">合规风控域 (risk)</option>
          </select>
        </div>
      </div>

      {/* Center Command Search Trigger */}
      <div className="flex-1 max-w-md mx-4">
        <button 
          onClick={onOpenCommandPalette}
          className="w-full h-8 px-3 rounded-lg bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 flex items-center justify-between text-xs text-slate-400 transition group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 transition" />
            <span>输入资产名、字段 (col:phone)、指标、或规则...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Deep Optimization Report Trigger */}
        <button
          onClick={onOpenDesignDoc}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-gradient-to-r from-indigo-500/20 to-blue-500/20 hover:from-indigo-500/30 hover:to-blue-500/30 text-indigo-300 border border-indigo-500/30 transition shadow-sm font-medium"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="hidden sm:inline">设计优化演进报告</span>
          <span className="sm:hidden">架构优化</span>
        </button>

        {/* Demo-data one-click toggle: default OFF = quasi-production (real data only) */}
        <button
          onClick={onToggleDemoMode}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition ${
            demoMode
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-medium'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title={demoMode
            ? '当前：演示数据模式（全站展示内置样例数据）— 点击切回准生产模式'
            : '当前：准生产模式（仅展示真实后端数据）— 点击切换演示数据'}
        >
          <FlaskConical className={`w-3.5 h-3.5 ${demoMode ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span className="hidden lg:inline">{demoMode ? '演示数据 ON' : '演示数据'}</span>
        </button>

        {/* Time Travel Historical Lineage Replay Switch */}
        <button
          onClick={onToggleTimeTravel}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition ${
            isTimeTravelActive 
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-medium animate-pulse'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="切入历史时点回放 (Bi-temporal Lineage Replay)"
        >
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden lg:inline">{isTimeTravelActive ? `历史模式 @ ${timeTravelDate}` : '时点回放'}</span>
        </button>

        {/* Replay date picker: only visible while time travel mode is active */}
        {isTimeTravelActive && onTimeTravelDateChange && (
          <input
            type="date"
            value={timeTravelDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onTimeTravelDateChange(e.target.value)}
            className="px-2 py-1 text-xs rounded-md bg-amber-500/10 border border-amber-500/40 text-amber-200 focus:outline-none"
            title="选择历史回放日期 (Bi-temporal Replay Date)"
          />
        )}

        {/* Notifications Icon with Badge */}
        <button
          onClick={onOpenNotifications}
          className="relative p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          title="通知与确认中心"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-900" />
          )}
        </button>

        {/* User Role Switcher (demo persona switcher) */}
        <div className="relative">
          <button 
            onClick={() => setRoleMenuOpen(!roleMenuOpen)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition ${roleLabels[currentUserRole].color}`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="font-medium">{roleLabels[currentUserRole].title}</span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {roleMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-44 rounded-lg bg-slate-900 border border-slate-800 shadow-xl py-1 z-50">
              <div className="px-2.5 py-1 text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                切换体验角色 (RBAC)
              </div>
              {(Object.keys(roleLabels) as UserRole[]).map((role) => (
                <button
                  key={role}
                  onClick={() => {
                    onRoleChange(role);
                    setRoleMenuOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                    currentUserRole === role ? 'text-indigo-400 font-medium' : 'text-slate-300'
                  }`}
                >
                  <span>{roleLabels[role].title}</span>
                  {currentUserRole === role && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Real logged-in user badge (JWT session) */}
        {authUser && (
          <div className="relative">
            <button
              onClick={() => { setAuthMenuOpen(!authMenuOpen); setRoleMenuOpen(false); }}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition ${ROLE_LABELS[authUser.role].color}`}
              title={`已登录：@${authUser.username}`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="font-medium max-w-[96px] truncate">{authUser.displayName}</span>
              <span className="opacity-75 hidden xl:inline">· {ROLE_LABELS[authUser.role].title}</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {authMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-lg bg-slate-900 border border-slate-800 shadow-xl py-1 z-50">
                <div className="px-2.5 py-1 text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  已登录账号 (JWT)
                </div>
                <div className="px-2.5 py-2">
                  <div className="text-xs font-medium text-slate-200">{authUser.displayName}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    @{authUser.username} · {ROLE_LABELS[authUser.role].title}
                    {authUser.role === 'VIEWER' && ' · 写操作只读拦截'}
                  </div>
                </div>
                <div className="border-t border-slate-800 mt-1 pt-1">
                  <button
                    onClick={() => { setAuthMenuOpen(false); onLogout?.(); }}
                    className="w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-2 text-rose-300 hover:bg-rose-500/10 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>退出登录</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
