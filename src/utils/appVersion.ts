/**
 * App version info injected by vite.config.ts into index.html
 * (git-derived, refreshed on every page load in dev, frozen at build time).
 */
export interface AppVersionInfo {
  /** Human readable version, e.g. v2026.10-b8f022c */
  version: string;
  /** Short git commit hash */
  commit: string;
  /** Current git branch */
  branch: string;
  /** Commit timestamp (ISO 8601), empty when unavailable */
  commitDate: string;
  /** Time this version snapshot was produced (ISO 8601) */
  buildTime: string;
}

declare global {
  interface Window {
    __APP_VERSION__?: AppVersionInfo;
  }
}

const FALLBACK: AppVersionInfo = {
  version: 'v0.0.0-dev',
  commit: 'unknown',
  branch: 'unknown',
  commitDate: '',
  buildTime: '',
};

/** Version of the running app; falls back to a dev placeholder outside vite. */
export const APP_VERSION: AppVersionInfo = window.__APP_VERSION__ ?? FALLBACK;

/** Formats an ISO timestamp as `YYYY-MM-DD HH:mm`; returns '—' when absent/invalid. */
export const formatVersionTime = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
