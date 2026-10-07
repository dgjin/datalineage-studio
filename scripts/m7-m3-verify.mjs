/**
 * Deep verification for M7 Validation Center (real API) and M3 Impact Analysis (real API).
 * Uses playwright-core with the locally cached chrome-headless-shell.
 *
 * Prereqs: backend on :8080 (V9 seed applied), dev server on :5173.
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

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

await page.route('**fonts.googleapis.com/**', (r) => r.abort());
await page.route('**fonts.gstatic.com/**', (r) => r.abort());

// Inject an admin session (RBAC AuthGuard) before the app loads
const _dlAuth = (await (await fetch('http://localhost:8080/api/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
})).json()).data;
await page.addInitScript((state) => {
  try { window.localStorage.setItem('dl_auth', state); } catch { /* ignore */ }
}, JSON.stringify({ token: _dlAuth.token, user: _dlAuth.user, expiresAt: Date.now() + _dlAuth.expiresInMs }));

await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4500);

// ============ M7 Validation Center ============
await page.locator('text=M7 校验中心').first().click();
await page.waitForTimeout(2000);
log('1. navigated to M7');

const rulesTabText = await page.locator('button:has-text("内置规则库")').first().innerText().catch(() => '');
ok('2. rule library shows 8 real rules [' + rulesTabText.trim() + ']', rulesTabText.includes('(8)'));

const issuesTabText = await page.locator('button:has-text("质量问题台账")').first().innerText().catch(() => '');
ok('3. issues ledger shows 5 real issues [' + issuesTabText.trim() + ']', issuesTabText.includes('(5)'));

ok('4. VR-004 rule visible in list', (await page.locator('text=资产 Owner 归属完整性检查').count()) > 0);
await page.screenshot({ path: OUT + '/m7-real-rules.png' });

// ---- rule enable/disable toggle (real API) ----
await page.locator('text=VR-006').first().click();
await page.waitForTimeout(700);
const toggleBtn = page.locator('button[title="点击启用/停用该规则（同步后端）"]').first();
const beforeToggle = (await toggleBtn.innerText()).trim();
await toggleBtn.click();
await page.waitForTimeout(1800);
const afterToggle = (await toggleBtn.innerText()).trim();
ok('5. rule toggle ON->OFF [' + beforeToggle + ' -> ' + afterToggle + ']', beforeToggle !== afterToggle);
await toggleBtn.click();
await page.waitForTimeout(1800);
const restored = (await toggleBtn.innerText()).trim();
ok('6. rule toggle restored [' + restored + ']', restored === beforeToggle);

// ---- dry run against real asset ----
await page.locator('button:has-text("执行校验")').first().click();
await page.waitForTimeout(2800);
ok('7. dry-run report rendered', (await page.locator('text=试运行检测报告').count()) > 0);
const summary = await page.locator('text=/目标资产/').first().innerText().catch(() => '');
log('   dry-run summary: ' + summary.replace(/\s+/g, ' ').slice(0, 160));
await page.screenshot({ path: OUT + '/m7-dryrun.png' });

// ---- issues ledger ----
await page.locator('button:has-text("质量问题台账")').first().click();
await page.waitForTimeout(900);
ok('8. issue ISS-2026-101 visible in ledger', (await page.locator('text=ISS-2026-101').count()) > 0);
await page.screenshot({ path: OUT + '/m7-real-issues.png' });

// ============ M3 Impact Analysis ============
await page.locator('text=M3 影响分析').first().click();
await page.waitForTimeout(1800);
// Pick ods_orders as the simulation root so the blast radius is meaningful
const m3AssetSelect = page.locator('select:has(option[value="asset:dl_demo.ods_orders"])').first();
await m3AssetSelect.selectOption('asset:dl_demo.ods_orders').catch(() => {});
await page.waitForTimeout(600);
await page.locator('button:has-text("立即运行影响预演分析")').first().click();
await page.waitForTimeout(4000);
ok('9. M3 simulation rendered real impact workbench', (await page.locator('text=/受影响资产与 Owner 确认工作台/').count()) > 0);
ok('10. M3 critical paths rendered', (await page.locator('text=/关键传播链路/').count()) > 0);
const m3Workbench = await page.locator('text=/受影响资产与 Owner 确认工作台/').first().innerText().catch(() => '');
log('   M3 workbench: ' + m3Workbench.replace(/\s+/g, ' ').slice(0, 120));
const m3Chain = await page.locator('text=/关键传播链路 · \\d+ 跳/').count().catch(() => 0);
log('   M3 real path chains rendered: ' + m3Chain);
await page.screenshot({ path: OUT + '/m3-real-sim.png' });

// ---- console errors (Google Fonts aborts are intentional in offline verification) ----
const realErrors = consoleErrors.filter(e =>
  !e.includes('fonts.googleapis') &&
  !e.includes('favicon') &&
  !e.includes('Failed to load resource'));
ok('11. no console errors', realErrors.length === 0);
realErrors.slice(0, 5).forEach(e => log('   ERR: ' + e.slice(0, 220)));

fs.writeFileSync(OUT + '/m7-m3-verify-report.txt', report.join('\n'));
await browser.close();
console.log('DONE');
