/**
 * 界面主题（强调色皮肤）管理。
 * - 切换方式：写 <html data-theme="...">，由 index.css 中的 [data-theme]
 *   规则重映射 --color-indigo-* 变量族（Tailwind v4 工具类消费这些变量）。
 * - 持久化到 localStorage，首帧前由 main.tsx 调用 initTheme() 恢复。
 */
export type ThemeId = 'indigo' | 'cyan' | 'emerald' | 'violet' | 'amber';

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
const DEFAULT_THEME: ThemeId = 'indigo';

export function getTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && THEMES.some(t => t.id === raw)) return raw as ThemeId;
  } catch { /* storage unavailable */ }
  return DEFAULT_THEME;
}

let transitionTimer: number | undefined;

/** 应用主题：写 <html data-theme> + 持久化；默认带一次短暂全局颜色过渡。 */
export function applyTheme(id: ThemeId, options?: { persist?: boolean; animate?: boolean }) {
  const persist = options?.persist ?? true;
  const animate = options?.animate ?? true;
  const root = document.documentElement;
  root.setAttribute('data-theme', id);
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, id); } catch { /* storage unavailable */ }
  }
  if (animate) {
    root.classList.add('theme-transition');
    if (transitionTimer) window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => root.classList.remove('theme-transition'), 300);
  }
}

/** 首帧恢复已保存主题（不带动画，避免加载闪烁）。 */
export function initTheme() {
  applyTheme(getTheme(), { persist: false, animate: false });
}
