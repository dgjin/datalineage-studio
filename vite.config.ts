import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execFileSync } from 'node:child_process';
import { defineConfig, Plugin } from 'vite';

/**
 * Git-derived app version, injected into index.html so the UI always shows the
 * revision that is actually running — no manual version bumps.
 *
 * Dev: transformIndexHtml runs on every page request, so a plain browser
 * refresh picks up the currently checked-out commit.
 * Build: the info is frozen once into the produced index.html.
 */
const runGit = (args: string[], fallback = ''): string => {
  try {
    return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback;
  } catch {
    return fallback;
  }
};

const buildVersionInfo = () => {
  const commit = runGit(['rev-parse', '--short', 'HEAD'], 'unknown');
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown');
  const commitDate = runGit(['log', '-1', '--format=%cI']);
  const now = new Date();
  const buildTime = now.toISOString();
  const version = `v${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}-${commit}`;
  return { version, commit, branch, commitDate, buildTime };
};

const appVersionPlugin = (): Plugin => ({
  name: 'app-version',
  transformIndexHtml() {
    const info = buildVersionInfo();
    return [
      {
        tag: 'script',
        children: `window.__APP_VERSION__ = ${JSON.stringify(info)};`,
        injectTo: 'head-prepend',
      },
    ];
  },
});

export default defineConfig(() => {
  return {
    plugins: [appVersionPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Proxy API requests to Spring Boot backend
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  };
});
