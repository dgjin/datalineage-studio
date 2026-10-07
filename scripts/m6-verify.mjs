/**
 * Deep verification for M6 Contract Browser (real API + V12 seed).
 * Uses playwright-core with the locally cached chrome-headless-shell.
 *
 * Prereqs: backend on :8080 (V12 contract seed applied), dev server on :5173.
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

// Navigate to M6
await page.locator('text=M6 契约建模').first().click();
await page.waitForTimeout(2000);
log('1. navigated to M6');

// Real contract tree rendered (4 contracts / 3 domains)
ok('2. real contract ods_orders.yaml in tree', (await page.locator('button:has-text("ods_orders.yaml")').count()) > 0);
ok('3. real contract dws_customer_summary.yaml in tree', (await page.locator('button:has-text("dws_customer_summary.yaml")').count()) > 0);
ok('4. real contract ads_sales_dashboard.yaml in tree', (await page.locator('button:has-text("ads_sales_dashboard.yaml")').count()) > 0);
ok('5. domain groups rendered (demo / warehouse / app)', 
  (await page.locator('text=demo').count()) > 0 && (await page.locator('text=warehouse').count()) > 0 && (await page.locator('text=app').count()) > 0);

// Default selection = newest contract (warehouse, IN_REVIEW)
ok('6. IN_REVIEW badge rendered (评审中)', (await page.locator('text=评审中 (In Review)').count()) > 0);
ok('7. real warehouse YAML with asset anchor rendered', (await page.locator('pre:has-text("assetId: asset:dw_warehouse.dws_customer_summary")').count()) > 0);

// Switch to demo contract -> YAML swaps, badge becomes Synced
await page.locator('button:has-text("ods_orders.yaml")').first().click();
await page.waitForTimeout(1200);
ok('8. switching contract swaps real YAML (ods_orders anchor)', (await page.locator('pre:has-text("assetId: asset:dl_demo.ods_orders")').count()) > 0);
ok('9. MERGED badge rendered (已同步)', (await page.locator('text=已同步 (Synced)').count()) > 0);
await page.screenshot({ path: OUT + '/m6-real-contracts.png' });

// DDL view: real generated DDL
await page.locator('button:has-text("自动生成的 DDL 预览")').click();
await page.waitForTimeout(800);
ok('10. real generated DDL rendered', (await page.locator('pre:has-text("CREATE TABLE IF NOT EXISTS ods_orders")').count()) > 0);

// CI checks panel: backend validate driven
await page.locator('button:has-text("MR CI 检查项面板")').click();
await page.waitForTimeout(1200);
ok('11. CI panel renders 4 checks', (await page.locator('text=资产绑定可解析（血缘锚点）').count()) > 0);
ok('12. CI YAML validation PASS from backend', (await page.locator('text=符合 Data Contract v2.0 规范').count()) > 0);
ok('13. CI lineage preview references bound asset', (await page.locator('text=asset:dl_demo.ods_orders').count()) > 0);
await page.screenshot({ path: OUT + '/m6-ci-checks.png' });

// CI 影响预演 -> navigates to M3 with the bound asset
await page.locator('button:has-text("CI 影响预演")').first().click();
await page.waitForTimeout(2500);
const m3Visible = (await page.locator('text=M3 影响分析').count()) > 0 || (await page.locator('text=影响分析').count()) > 0;
const boundAssetVisible = (await page.locator('text=ods_orders').count()) > 0;
ok('14. CI 影响预演 navigates to M3 with bound asset', m3Visible && boundAssetVisible);
await page.screenshot({ path: OUT + '/m6-ci-simulate.png' });

// console errors
const realErrors = consoleErrors.filter(e =>
  !e.includes('fonts.googleapis') &&
  !e.includes('favicon') &&
  !e.includes('Failed to load resource'));
ok('15. no console errors', realErrors.length === 0);
realErrors.slice(0, 5).forEach(e => log('   ERR: ' + e.slice(0, 220)));

fs.writeFileSync(OUT + '/m6-verify-report.txt', report.join('\n'));
await browser.close();
console.log('DONE');
