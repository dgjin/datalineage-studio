/**
 * Governance UI smoke test (M9 运营看板 / M12 标准中枢 / M4 审批看板).
 * Uses playwright-core with the locally cached chrome-headless-shell.
 * Run: node scripts/governance-smoke.mjs   (requires vite :5173 + backend :8080)
 */
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const report = [];
const log = (s) => { console.log('[SMOKE] ' + s); report.push(s); };

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

await page.route('**fonts.googleapis.com/**', (r) => r.abort());
await page.route('**fonts.gstatic.com/**', (r) => r.abort());

await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3000);

// ---- M9 运营看板（真实聚合数据） ----
await page.locator('text=M9 运营看板').first().click();
await page.waitForTimeout(3500);
log('1. M9 平均健康分 label: ' + await page.locator('text=/平均健康分/').count());
log('2. M9 真实分数 74.5 visible: ' + await page.locator('text=74.5').count());
log('3. M9 分层明细 visible: ' + await page.locator('text=/分层|ODS/').count());
await page.screenshot({ path: path.join(OUT, 'smoke-m9-dashboard.png') });

// ---- M12 标准中枢（标准列表 + 词根 + 编码集） ----
await page.locator('text=M12 标准中枢').first().click();
await page.waitForTimeout(3000);
log('4. M12 标准卡片 STD-NAMING-001 visible: ' + await page.locator('text=STD-NAMING-001').count());
log('5. M12 标准名称 visible: ' + await page.locator('text=数仓分层前缀命名规范').count());
await page.screenshot({ path: path.join(OUT, 'smoke-m12-standards.png') });
// 切到词根 tab
const glossaryTab = page.locator('button:has-text("术语词根"), button:has-text("词根")').first();
if (await glossaryTab.count()) {
  await glossaryTab.click();
  await page.waitForTimeout(1500);
  log('6. M12 词根 tab 内容 (amt/gmv): ' + await page.locator('text=/gmv|成交总额/').count());
}
// 切到编码集 tab
const codesTab = page.locator('button:has-text("编码")').first();
if (await codesTab.count()) {
  await codesTab.click();
  await page.waitForTimeout(1500);
  log('7. M12 编码集 ORDER_STATUS visible: ' + await page.locator('text=ORDER_STATUS').count());
  await page.screenshot({ path: path.join(OUT, 'smoke-m12-codes.png') });
}

// ---- M4 变更中心（待审批门禁 tab） ----
await page.locator('text=M4 变更中心').first().click();
await page.waitForTimeout(2500);
const approvalTab = page.locator('button:has-text("待审批门禁")').first();
if (await approvalTab.count()) {
  await approvalTab.click();
  await page.waitForTimeout(2000);
}
log('8. M4 待审批变更 ods_orders visible: ' + await page.locator('text=ods_orders').count());
log('9. M4 审批门禁区 visible: ' + await page.locator('text=/发布审批|待审批/').count());
await page.screenshot({ path: path.join(OUT, 'smoke-m4-approval.png') });

log('console errors: ' + (consoleErrors.length === 0 ? 'NONE' : JSON.stringify(consoleErrors.slice(0, 8))));

await browser.close();
fs.writeFileSync(path.join(OUT, 'governance-smoke-report.txt'), report.join('\n'));
console.log('[SMOKE] DONE');
