import React, { useEffect, useState } from 'react';
import {
  Network,
  ShieldCheck,
  UserCheck,
  LogIn,
  Loader2,
  AlertCircle,
  Eye,
  Crown,
  Scale,
} from 'lucide-react';
import { AUTH_STORAGE_KEY, authApi, AuthUser } from '../services/api';

/** Auth session persisted in localStorage, shared with apiFetch's bearer injection. */
export interface AuthState {
  token: string;
  user: AuthUser;
  expiresAt: number;
}

export const ROLE_LABELS: Record<AuthUser['role'], { title: string; color: string }> = {
  ADMIN: { title: '平台管理员', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  GOVERNOR: { title: '治理管理员', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  VIEWER: { title: '只读观察员', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
};

export function getAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    if (!parsed?.token || !parsed?.user) return null;
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistAuth(state: AuthState | null) {
  if (state) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  window.dispatchEvent(new Event('auth:changed'));
}

export function logout() {
  persistAuth(null);
}

/** Reactive auth state: re-reads on login/logout and on 401 broadcasts from apiFetch. */
export function useAuth(): AuthState | null {
  const [auth, setAuth] = useState<AuthState | null>(() => getAuth());

  useEffect(() => {
    const sync = () => setAuth(getAuth());
    window.addEventListener('auth:changed', sync);
    window.addEventListener('auth:unauthorized', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('auth:changed', sync);
      window.removeEventListener('auth:unauthorized', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return auth;
}

/** Write permission: ADMIN and GOVERNOR may mutate, VIEWER is read-only. */
export function canWrite(auth: AuthState | null): boolean {
  return !!auth && auth.user.role !== 'VIEWER';
}

const DEMO_ACCOUNTS: Array<{
  username: string;
  password: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  accent: string;
}> = [
  {
    username: 'admin',
    password: 'admin123',
    title: '林浩然 · 平台管理员',
    desc: 'ADMIN — 全部读写权限（采集、审批、标准维护）',
    icon: <Crown className="w-4 h-4 text-rose-400" />,
    accent: 'hover:border-rose-500/50 hover:bg-rose-500/5',
  },
  {
    username: 'governor',
    password: 'governor123',
    title: '赵静 · 治理管理员',
    desc: 'GOVERNOR — 治理写权限（审批、血缘、变更处置）',
    icon: <Scale className="w-4 h-4 text-purple-400" />,
    accent: 'hover:border-purple-500/50 hover:bg-purple-500/5',
  },
  {
    username: 'viewer',
    password: 'viewer123',
    title: '苏婉清 · 只读观察员',
    desc: 'VIEWER — 仅浏览，写操作将被拒绝 (403)',
    icon: <Eye className="w-4 h-4 text-slate-400" />,
    accent: 'hover:border-slate-500/50 hover:bg-slate-500/5',
  },
];

const LoginScreen: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doLogin = async (user: string, pass: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login(user, pass);
      persistAuth({
        token: res.token,
        user: res.user,
        expiresAt: Date.now() + (res.expiresInMs || 8 * 3600 * 1000),
      });
    } catch (e: any) {
      setError(e?.message || '登录失败，请检查用户名与密码');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('请输入用户名与密码');
      return;
    }
    void doLogin(username.trim(), password);
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-100 font-sans relative overflow-hidden">
      {/* Ambient brand glow */}
      <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[480px] h-[480px] rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl mx-4 grid md:grid-cols-2 gap-6 relative z-10">
        {/* Brand panel */}
        <div className="hidden md:flex flex-col justify-between rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-7 shadow-2xl">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-11 h-11 rounded-xl p-0.5 shadow-lg shadow-indigo-500/20"
                style={{ backgroundImage: 'var(--brand-gradient)' }}
              >
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Network className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-lg tracking-tight text-slate-100">DataLineage</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Studio</span>
                </div>
                <p className="text-xs text-slate-400">通用数据血缘与变更治理平台</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-300">
              {[
                ['字段级血缘追踪与影响分析', ShieldCheck],
                ['变更审批与治理工作流', UserCheck],
                ['多源采集 · 指标 · 契约 · 校验', Network],
              ].map(([label, Icon]: any) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            基于 JWT 的无状态认证 · 三角色 RBAC（ADMIN / GOVERNOR / VIEWER）<br />
            只读角色可浏览全部数据，写操作需要管理员角色令牌。
          </p>
        </div>

        {/* Login form panel */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur p-7 shadow-2xl">
          <h1 className="text-lg font-bold text-slate-100 mb-1">登录控制台</h1>
          <p className="text-xs text-slate-400 mb-5">使用平台账号登录，或选择下方演示账号一键体验。</p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">用户名</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={loading}
                className="w-full h-9 px-3 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500/60 focus:outline-none text-sm text-slate-100 placeholder-slate-600 transition disabled:opacity-50"
                placeholder="admin / governor / viewer"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                className="w-full h-9 px-3 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500/60 focus:outline-none text-sm text-slate-100 placeholder-slate-600 transition disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-500/20 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-800">
            <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider mb-2.5">演示账号一键登录</p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setUsername(acc.username);
                    setPassword(acc.password);
                    void doLogin(acc.username, acc.password);
                  }}
                  className={`w-full text-left flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5 transition disabled:opacity-50 ${acc.accent}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                    {acc.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-200">{acc.title}</div>
                    <div className="text-[10px] text-slate-500 truncate">{acc.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Blocks the app shell until a valid session exists; renders the login screen otherwise. */
export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  if (!auth) return <LoginScreen />;
  return <>{children}</>;
};

export default AuthGuard;
