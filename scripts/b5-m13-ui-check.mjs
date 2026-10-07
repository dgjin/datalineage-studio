/**
 * Browser UI check for M13 version management (batch 5):
 * version chain chips, version compare result table, markdown/csv export downloads.
 *
 * Prereqs: backend :8080 (V17), vite :5173, fixtures imported via scripts/m13-verify.mjs.
 */
import { chromium } from 'playwright-core';
import fs from 'fs';

const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const report = [];
const log = (s) => { console.log('[UI] ' + s); report.push(s); };
let failures = 0;
const ok = (name, cond) => { log((cond ? 'PASS  ' : 'FAIL  ') + name); if (!cond) failures++; return cond; };

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });

// Inject admin session (AuthGuard admits the app shell)
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
await page.waitForTimeout(4000);

// --- Navigate to M13 ---
await page.locator('text=M13 数据模型').first().click();
await page.waitForTimeout(1500);
ok('1. M13 module opened', (await page.locator('text=M13 数据模型前置管理').count()) > 0);

// --- Select the PDM smoke model ---
await page.locator('text=PDM 冒烟模型').first().click();
await page.waitForSelector('[data-testid="m13-version-panel"]', { timeout: 10000 });
await page.waitForTimeout(1000);
ok('2. version panel rendered', true);

const panel = page.locator('[data-testid="m13-version-panel"]');
ok('3. version chain chip v2.0', (await panel.locator('button:has-text("v2.0")').count()) > 0);
ok('4. version chain chip v1.0', (await panel.locator('button:has-text("v1.0")').count()) > 0);
ok('5. source format badge PD_PDM', (await panel.locator('text=PD_PDM').count()) > 0);

// --- Run version compare ---
await page.locator('button:has-text("版本对比")').click();
await page.waitForSelector('[data-testid="m13-version-diff-result"]', { timeout: 15000 });
await page.waitForTimeout(400);
ok('6. diff result table rendered', true);
const diffText = await page.locator('[data-testid="m13-version-diff-result"]').innerText();
ok('7. diff lists added table ODS_PRD_PRODUCT', diffText.includes('ODS_PRD_PRODUCT'));
ok('8. diff lists removed column CUST_LEVEL', diffText.includes('CUST_LEVEL'));
ok('9. diff lists changed column 32 -> 64', diffText.includes('ORDER_STATUS') && diffText.includes('VARCHAR2(32)') && diffText.includes('VARCHAR2(64)'));
ok('10. summary shows total 4 differences', diffText.includes('合计 4 项差异'));
await page.screenshot({ path: OUT + '/m13-version-panel.png' });

// --- Export markdown (real browser download) ---
{
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.locator('button:has-text("导出 Markdown")').click();
  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  ok('11. markdown download filename is .md', suggested.endsWith('.md'));
  const savePath = '/tmp/' + suggested;
  await download.saveAs(savePath);
  const mdContent = fs.readFileSync(savePath, 'utf8');
  ok('12. downloaded markdown has report title', mdContent.includes('模型版本对比报告'));
  ok('13. downloaded markdown lists diff rows', mdContent.includes('ODS_PRD_PRODUCT') && mdContent.includes('ORDER_STATUS'));
}

// --- Export csv ---
{
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.locator('button:has-text("导出 CSV")').click();
  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  ok('14. csv download filename is .csv', suggested.endsWith('.csv'));
  const savePath = '/tmp/' + suggested;
  await download.saveAs(savePath);
  ok('15. downloaded csv contains diff rows', fs.readFileSync(savePath, 'utf8').includes('TABLE_ADDED'));
}

// --- Console health (filter known noise: mock-probe 400s, self-aborted font requests) ---
const realErrors = consoleErrors.filter((e) =>
  !e.includes('favicon') && !e.includes('asset-health') && !e.includes('status of 400')
  && !e.includes('net::ERR_FAILED'));
if (realErrors.length) log('console errors: ' + realErrors.slice(0, 5).join(' | '));
ok('16. no unexpected console errors', realErrors.length === 0);

await browser.close();
const passed = report.filter((l) => l.startsWith('PASS')).length;
const total = report.filter((l) => l.startsWith('PASS') || l.startsWith('FAIL')).length;
log(`===== M13 UI CHECK: ${passed}/${total} ${failures === 0 ? 'ALL PASS' : 'FAILURES=' + failures} =====`);
fs.writeFileSync(`${OUT}/m13-ui-report.txt`, report.join('\n') + '\n');
process.exit(failures === 0 ? 0 : 1);
