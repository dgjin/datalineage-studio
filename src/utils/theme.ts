/**
 * 界面外观管理：强调色皮肤（肤色）+ 明暗模式（两维度正交，可自由组合）。
 * - 肤色：写 <html data-theme="...">，由 index.css 的 [data-theme] 规则
 *   重映射 --color-indigo-* 变量族（Tailwind v4 工具类消费这些变量）。
 * - 明暗：写 <html data-mode="dark|light">，由 [data-mode="light"] 规则
 *   反转 slate 色阶并加深语义色浅档。
 * - 两者均持久化到 localStorage，首帧前由 main.tsx 调用 initTheme() 恢复。
 */
export type ThemeId = 'indigo' | 'cyan' | 'emerald' | 'violet' | 'amber';
export type ModeId = 'dark' | 'light';

export interface ThemePreset {
  id: ThemeId;
  label: string;
  desc: string;
  /** 预览色块用 Tailwind 类（完整字面量，供构建扫描） */
  swatch: string;
}

export const THEMES: ThemePreset[] = [
  { id: 'indigo', label: '经典靛蓝', desc: '默认 · 沉稳专业', swatch: 'bg-indigo-500' },
  { id: 'cyan', label: '科技青', desc: '冷冽 · 数据感', swatch: 'bg-cyan-500' },
  { id: 'emerald', label: '翡翠绿', desc: '生态 · 增长感', swatch: 'bg-emerald-500' },
  { id: 'violet', label: '紫罗兰', desc: '前沿 · 智能感', swatch: 'bg-violet-500' },
  { id: 'amber', label: '琥珀金', desc: '暖色 · 高对比', swatch: 'bg-amber-500' },
];

const THEME_STORAGE_KEY = 'dl_theme';
const MODE_STORAGE_KEY = 'dl_mode';
const DEFAULT_THEME: ThemeId = 'indigo';
const DEFAULT_MODE: ModeId = 'dark';

interface ApplyOptions {
  persist?: boolean;
  animate?: boolean;
}

let transitionTimer: number | undefined;

/** 切换外观时的一次性全局颜色过渡（约 300ms 后移除类名） */
function flashTransition() {
  const root = document.documentElement;
  root.classList.add('theme-transition');
  if (transitionTimer) window.clearTimeout(transitionTimer);
  transitionTimer = window.setTimeout(() => root.classList.remove('theme-transition'), 300);
}

export function getTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && THEMES.some(t => t.id === raw)) return raw as ThemeId;
  } catch { /* storage unavailable */ }
  return DEFAULT_THEME;
}

export function getMode(): ModeId {
  try {
    const raw = localStorage.getItem(MODE_STORAGE_KEY);
    if (raw === 'dark' || raw === 'light') return raw;
  } catch { /* storage unavailable */ }
  return DEFAULT_MODE;
}

/** 应用强调色：写 <html data-theme> + 持久化；默认带一次短暂全局颜色过渡。 */
export function applyTheme(id: ThemeId, options?: ApplyOptions) {
  const persist = options?.persist ?? true;
  const animate = options?.animate ?? true;
  document.documentElement.setAttribute('data-theme', id);
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, id); } catch { /* storage unavailable */ }
  }
  if (animate) flashTransition();
}

/** 应用明暗模式：写 <html data-mode> + 持久化；默认带一次短暂全局颜色过渡。 */
export function applyMode(id: ModeId, options?: ApplyOptions) {
  const persist = options?.persist ?? true;
  const animate = options?.animate ?? true;
  document.documentElement.setAttribute('data-mode', id);
  if (persist) {
    try { localStorage.setItem(MODE_STORAGE_KEY, id); } catch { /* storage unavailable */ }
  }
  if (animate) flashTransition();
}

/** 首帧恢复已保存外观（不带动画，避免加载闪烁）。 */
export function initTheme() {
  applyTheme(getTheme(), { persist: false, animate: false });
  applyMode(getMode(), { persist: false, animate: false });
}
