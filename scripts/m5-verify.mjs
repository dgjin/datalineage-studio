/**
 * Deep verification for M5 Metric Center (real API + V11 seed).
 * Uses playwright-core with the locally cached chrome-headless-shell.
 *
 * Prereqs: backend on :8080 (V11 metric seed applied), dev server on :5173.
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

await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4500);

// Navigate to M5
await page.locator('text=M5 指标中心').first().click();
await page.waitForTimeout(2000);
log('1. navigated to M5');

// Real metric count badge + real metrics rendered
ok('2. real metric count badge (6 项治理指标)', (await page.locator('text=6 项治理指标').count()) > 0);
ok('3. real metric MET-TRD-GMV-001 visible', (await page.locator('span:has-text("MET-TRD-GMV-001")').count()) > 0);
ok('4. real metric MET-CRM-VIP-002 visible', (await page.locator('span:has-text("MET-CRM-VIP-002")').count()) > 0);

// Select MET-TRD-GMV-001 -> detail pane with 3-level tracing
await page.locator('span:has-text("MET-TRD-GMV-001")').first().click();
await page.waitForTimeout(1500);
ok('5. detail pane renders caliber card (SUM(gmv))', (await page.locator('text=SUM(gmv)').count()) > 0);
ok('6. physical column mapping shows real column gmv', (await page.locator('code:has-text("gmv"), .font-mono:has-text("gmv")').count()) > 0);
ok('7. real column binding asset dws_order_metrics rendered', (await page.locator('text=dws_order_metrics').count()) > 0);

// Real version history from metric_history table (v1.2 breaking entry)
ok('8. real history version v1.2 rendered', (await page.locator('text=v1.2').count()) > 0);
ok('9. breaking-history-data badge rendered', (await page.locator('text=历史数据不可直接横向比较').count()) > 0);
await page.screenshot({ path: OUT + '/m5-real-metrics.png' });

// Quick filter: MISSING_CODE -> only unbound DRAFT metric remains (assert inside the left list only,
// the right detail pane still shows the previously selected metric)
const list = page.locator('div.divide-y').first();
await page.locator('button:has-text("未赋码指标")').click();
await page.waitForTimeout(800);
const missingVisible = await list.locator('span:has-text("MET-CUS-VAL-006")').count();
const boundHidden = await list.locator('span:has-text("MET-TRD-GMV-001")').count();
ok('10. MISSING_CODE filter keeps unbound metric & hides bound ones', missingVisible > 0 && boundHidden === 0);

// Quick filter: COMPOSITE_DAG -> only composite metrics with upstream deps
await page.locator('button:has-text("复合依赖图")').click();
await page.waitForTimeout(800);
const compositeVisible = await list.locator('span:has-text("MET-CRM-ACT-001")').count();
const atomicHidden = await list.locator('span:has-text("MET-TRD-GMV-001")').count();
ok('11. COMPOSITE_DAG filter keeps composite metric & hides atomic ones', compositeVisible > 0 && atomicHidden === 0);
await page.locator('button:has-text("全部指标")').click();
await page.waitForTimeout(600);

// Explore metric lineage -> M2 graph with metric asset
await page.locator('span:has-text("MET-TRD-GMV-001")').first().click();
await page.waitForTimeout(900);
await page.locator('button:has-text("探索该指标图谱")').first().click();
await page.waitForTimeout(3000);
const metricNodeOrTitle = (await page.locator('text=metric:gmv_30d').count()) + (await page.locator('text=近30天累计有效成交规模').count());
ok('12. explore lineage shows metric asset in M2 graph', metricNodeOrTitle > 0);
await page.screenshot({ path: OUT + '/m5-metric-graph.png' });

// console errors
const realErrors = consoleErrors.filter(e =>
  !e.includes('fonts.googleapis') &&
  !e.includes('favicon') &&
  !e.includes('Failed to load resource'));
ok('13. no console errors', realErrors.length === 0);
realErrors.slice(0, 5).forEach(e => log('   ERR: ' + e.slice(0, 220)));

fs.writeFileSync(OUT + '/m5-verify-report.txt', report.join('\n'));
await browser.close();
console.log('DONE');
