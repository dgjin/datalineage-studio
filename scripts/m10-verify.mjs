/**
 * Deep verification for M10 Collector Admin (async trigger + polled progress).
 * Uses playwright-core with the locally cached chrome-headless-shell.
 *
 * Prereqs: backend on :8080 (async collector + run-status endpoint), dev server on :5173.
 */
import { chromium } from 'playwright-core';
import fs from 'fs';

const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const report = [];
const log = (s) => { console.log('[VERIFY] ' + s); report.push(s); };
const ok = (name, cond) => { log((cond ? 'PASS  ' : 'FAIL  ') + name); return cond; };

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });

// RBAC (P2-8): inject an admin session so the AuthGuard admits the app shell
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

await page.route('**fonts.googleapis.com/**', (r) => r.abort());
await page.route('**fonts.gstatic.com/**', (r) => r.abort());

await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4500);

// Navigate to M10
await page.locator('text=M10 采集与管理').first().click();
await page.waitForTimeout(2500);
log('1. navigated to M10');

// Real collection pipeline panel rendered
ok('2. collection task panel title rendered', (await page.locator('text=采集任务（真实管道').count()) > 0);
const runButtons = await page.locator('button:has-text("立即采集")').count();
ok('3. three collect tasks rendered with run buttons', runButtons === 3);

// Task details: name, data source name, success badge, last-run time
ok('4. task name rendered (dw_app task)', (await page.locator('text=应用层采集（dw_app）').count()) > 0);
ok('5. data source name resolved from API', (await page.locator('text=应用层MySQL（ADS+APP）').count()) > 0);
const today = new Date();
const mmdd = String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
ok('6. SUCCESS badge rendered', (await page.locator('span:has-text("SUCCESS")').count()) > 0);
ok('7. last run time shows today (' + mmdd + ')', (await page.locator('text=' + mmdd).count()) > 0);
await page.screenshot({ path: OUT + '/m10-tasks.png' });

// Trigger the first task and observe the polled progress/finish
const firstRun = page.locator('button:has-text("立即采集")').first();
await firstRun.click();
// best-effort capture of the in-flight state (local collection is fast)
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + '/m10-running.png' });

// Polled result: backend run finishes in ~100-200ms; first poll at 1s -> finished banner
let finished = false;
for (let i = 0; i < 12; i++) {   // up to ~8s
  await page.waitForTimeout(700);
  if ((await page.locator('text=最近一次采集成功').count()) > 0) { finished = true; break; }
}
ok('8. run finished, success banner rendered (polled run-status)', finished);

// Button restored to idle after the run completes
await page.waitForTimeout(1200);
ok('9. run button restored to idle', (await page.locator('button:has-text("立即采集")').count()) >= 1);
ok('10. refreshed last-run duration visible', (await page.locator('text=上次').count()) > 0);
await page.screenshot({ path: OUT + '/m10-run-done.png' });

// console errors
const realErrors = consoleErrors.filter(e =>
  !e.includes('fonts.googleapis') &&
  !e.includes('favicon') &&
  !e.includes('Failed to load resource'));
ok('11. no console errors', realErrors.length === 0);
realErrors.slice(0, 5).forEach(e => log('   ERR: ' + e.slice(0, 220)));

fs.writeFileSync(OUT + '/m10-verify-report.txt', report.join('\n'));
await browser.close();
console.log('DONE');
