/**
 * Full-module UI smoke: walks every sidebar entry (workbench + M1-M13 + help),
 * asserting each module renders real content (no blank screen, no ErrorBoundary
 * fallback, no console errors / uncaught exceptions).
 *
 * Prereqs: backend on :8080, dev server on :5173.
 * Run from the repo root: node scripts/full-module-smoke.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'fs';

const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const report = [];
let failures = 0;
const log = (s) => { console.log('[SMOKE] ' + s); report.push(s); };
const ok = (name, cond) => { if (!cond) failures++; log((cond ? 'PASS  ' : 'FAIL  ') + name); return cond; };

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });

// Inject an admin session (RBAC AuthGuard)
const loginRes = await fetch('http://localhost:8080/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
});
const authData = (await loginRes.json()).data;
await page.addInitScript((state) => {
  try { window.localStorage.setItem('dl_auth', state); } catch { /* ignore */ }
}, JSON.stringify({ token: authData.token, user: authData.user, expiresAt: Date.now() + authData.expiresInMs }));

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));
page.on('crash', () => consoleErrors.push('RENDERER CRASH'));
await page.route('**fonts.googleapis.com/**', (r) => r.abort());
await page.route('**fonts.gstatic.com/**', (r) => r.abort());

const noise = (e) => e.includes('fonts.googleapis') || e.includes('favicon') || e.includes('Failed to load resource');

await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4000);

// nav label -> optional hard assertion text verified by earlier deep scripts
const MODULES = [
  { label: '工作台', probe: null },
  { label: 'M1 资产目录', probe: '资产目录' },
  { label: 'M2 血缘探索器', probe: null },
  { label: 'M3 影响分析', probe: null },
  { label: 'M4 变更中心', probe: null },
  { label: 'M5 指标中心', probe: null },
  { label: 'M6 契约建模', probe: null },
  { label: 'M7 校验中心', probe: null },
  { label: 'M8 通知中心', probe: null },
  { label: 'M9 运营看板', probe: '平均资产健康分' },
  { label: 'M10 采集与管理', probe: '采集任务（真实管道' },
  { label: 'M11 数据源接入', probe: null },
  { label: 'M12 标准中枢', probe: null },
  { label: 'M13 数据模型', probe: 'M13 数据模型前置管理' },
  { label: '帮助中心', probe: '帮助中心 · 操作闭环与配置指南' },
];

let idx = 0;
for (const m of MODULES) {
  idx++;
  const errorsBefore = consoleErrors.length;
  await page.locator('aside').locator(`text=${m.label}`).first().click();
  await page.waitForTimeout(1800);

  const bodyText = await page.locator('body').innerText().catch(() => '');
  const hasFallback = bodyText.includes('渲染异常');
  const h1 = await page.locator('main h1').first().innerText().catch(() => '');
  const domNodes = await page.locator('main > *').count().catch(() => 0);

  const newErrors = consoleErrors.slice(errorsBefore).filter((e) => !noise(e));
  const line = `${String(idx).padStart(2)}. ${m.label} — body=${bodyText.length}ch dom=${domNodes} h1="${h1.slice(0, 30)}"`;

  if (!ok(line + ' rendered', bodyText.length >= 300 && domNodes > 0)) continue;
  ok(`${m.label} — no ErrorBoundary fallback`, !hasFallback);
  ok(`${m.label} — no console errors (${newErrors.length})`, newErrors.length === 0);
  newErrors.slice(0, 3).forEach((e) => log('   ERR: ' + e.slice(0, 200)));
  if (m.probe) {
    ok(`${m.label} — key content "${m.probe}" visible`, bodyText.includes(m.probe));
  }
}

// Screenshots of representative modules
await page.locator('aside').locator('text=工作台').first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + '/full-smoke-workbench.png' });
await page.locator('aside').locator('text=M2 血缘探索器').first().click();
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT + '/full-smoke-m2.png' });
await page.locator('aside').locator('text=M9 运营看板').first().click();
await page.waitForTimeout(2000);
await page.screenshot({ path: OUT + '/full-smoke-m9.png' });

const realErrors = consoleErrors.filter((e) => !noise(e));
ok(`global console error count = 0 (got ${realErrors.length})`, realErrors.length === 0);

await browser.close();
fs.writeFileSync(OUT + '/full-module-smoke-report.txt', report.join('\n') + '\n');
console.log(`\n${report.filter((l) => l.startsWith('PASS')).length}/${report.filter((l) => l.startsWith('PASS') || l.startsWith('FAIL')).length} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
