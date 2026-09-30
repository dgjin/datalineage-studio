/**
 * Browser verification script for M11 Data Source Manager UI.
 * Uses playwright-core with the locally cached chrome-headless-shell.
 */
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const report = [];
const log = (s) => { console.log('[VERIFY] ' + s); report.push(s); };

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

// Block external font loading (offline-safe, avoids blocking page load)
await page.route('**fonts.googleapis.com/**', (r) => r.abort());
await page.route('**fonts.gstatic.com/**', (r) => r.abort());

await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3500);

// 1. Navigate to M11
await page.locator('text=M11 数据源接入').first().click();
await page.waitForTimeout(2500);
log('1. navigated to M11');

// 2. Backend online indicator
const onlineCount = await page.locator('text=后端已连接').count();
log('2. backend online indicator: ' + (onlineCount > 0 ? 'CONNECTED' : 'NOT CONNECTED'));

// 3. Data source list
const dsVisible = await page.locator('text=本地测试MySQL').count();
log('3. datasource "本地测试MySQL" cards: ' + dsVisible);

// 4. Click test connection
const testBtn = page.locator('button:has-text("测试连接")').first();
if (await testBtn.count()) {
  await testBtn.click();
  await page.waitForTimeout(4500);
  const successText = await page.locator('text=/MySQL 8|4ms|ms/').count();
  const failText = await page.locator('text=/失败|Network error/').count();
  log('4. test connection result: success-shown=' + (successText > 0) + ' fail-shown=' + (failText > 0));
} else {
  log('4. test connection button NOT FOUND');
}

await page.screenshot({ path: path.join(OUT, 'm11-1-datasources.png') });
log('screenshot: ' + path.join(OUT, 'm11-1-datasources.png'));

// 5. Switch to collect tasks tab
await page.locator('button:has-text("采集任务 (")').first().click();
await page.waitForTimeout(1500);
const taskName = await page.locator('text=datalineage库元数据采集').count();
log('5. task "datalineage库元数据采集" visible: ' + taskName);

// 6. Click run now
const runBtn = page.locator('button:has-text("立即执行")').first();
if (await runBtn.count()) {
  await runBtn.click();
  log('6. clicked 立即执行, waiting for result...');
  await page.waitForTimeout(9000);
  const doneMsg = await page.locator('text=/采集完成|采集失败/').count();
  log('6. run result message shown: ' + (doneMsg > 0));
} else {
  log('6. run-now button NOT FOUND');
}

// 7. Expand logs
const logBtn = page.locator('button:has-text("日志")').first();
if (await logBtn.count()) {
  await logBtn.click();
  await page.waitForTimeout(2000);
  const logPanel = await page.locator('text=/最近运行日志|tables|SUCCESS/').count();
  log('7. log panel visible: ' + (logPanel > 0));
}

await page.screenshot({ path: path.join(OUT, 'm11-2-collect-tasks.png') });
log('screenshot: ' + path.join(OUT, 'm11-2-collect-tasks.png'));

// Full page screenshot
await page.screenshot({ path: path.join(OUT, 'm11-3-fullpage.png'), fullPage: true });
log('screenshot: ' + path.join(OUT, 'm11-3-fullpage.png'));

// Console errors
log('console errors: ' + (consoleErrors.length === 0 ? 'NONE' : JSON.stringify(consoleErrors.slice(0, 8))));

await browser.close();
fs.writeFileSync(path.join(OUT, 'verify-report.txt'), report.join('\n'));
console.log('[VERIFY] DONE');
