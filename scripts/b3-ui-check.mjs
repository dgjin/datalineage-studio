/**
 * Batch-3 UI verification: M9 audit-trail drawer + M8 webhook configuration modal.
 * Requires vite :5173 and backend :8080 running. Run from the repo root:
 *   node scripts/b3-ui-check.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'fs';

const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const report = [];
let failures = 0;
const log = (s) => { console.log('[UI] ' + s); report.push(s); };
const ok = (name, cond) => { if (!cond) failures++; log((cond ? 'PASS  ' : 'FAIL  ') + name); return cond; };

const loginRes = await fetch('http://localhost:8080/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
});
const authData = (await loginRes.json()).data;

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
await page.addInitScript((state) => {
  try { window.localStorage.setItem('dl_auth', state); } catch { /* ignore */ }
}, JSON.stringify({ token: authData.token, user: authData.user, expiresAt: Date.now() + authData.expiresInMs }));

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2500);

// ---------- M9: audit trail drawer ----------
await page.locator('text=M9 运营看板').first().click();
await page.waitForTimeout(2000);
const auditBtn = page.locator('button:has-text("审计轨迹")').first();
ok('1. M9 shows the audit-trail button', await auditBtn.isVisible());
await auditBtn.click();
await page.waitForTimeout(1500);
ok('2. audit drawer heading visible', await page.locator('text=全链路审计轨迹').first().isVisible());
const rows = await page.locator('text=/SUCCESS|FAILED/').count();
ok(`3. audit records rendered (${rows} result badges)`, rows > 0);
await page.screenshot({ path: `${OUT}/b3-m9-audit-drawer.png` });
log(`   screenshot -> ${OUT}/b3-m9-audit-drawer.png`);
await page.locator('text=全链路审计轨迹').first().locator('xpath=ancestor::div[contains(@class,"max-w-xl")]//button').first().click();
await page.waitForTimeout(600);

// ---------- M8: webhook configuration modal ----------
await page.locator('text=M8 通知中心').first().click();
await page.waitForTimeout(1500);
const hookBtn = page.locator('button:has-text("Webhook 配置")').first();
ok('4. M8 shows the webhook-config button', await hookBtn.isVisible());
await hookBtn.click();
await page.waitForTimeout(1500);
ok('5. webhook modal heading visible', await page.locator('text=Webhook 订阅配置').first().isVisible());
ok('6. create form rendered', await page.locator('input[placeholder*="订阅名称"]').first().isVisible());
ok('7. event checkboxes rendered', (await page.locator('text=change.created').count()) > 0);
await page.screenshot({ path: `${OUT}/b3-m8-webhook-modal.png` });
log(`   screenshot -> ${OUT}/b3-m8-webhook-modal.png`);

// form interaction: create a subscription toward the local receiver if it is up, then delete it
await page.fill('input[placeholder*="订阅名称"]', 'UI 冒烟订阅');
await page.fill('input[placeholder*="ci.example.com"]', 'http://localhost:9099/ui-hook');
await page.locator('button:has-text("创建订阅")').click();
await page.waitForTimeout(1800);
ok('8. subscription appears in the list', (await page.locator('text=UI 冒烟订阅').count()) > 0);
await page.locator('button:has-text("测试")').first().click();
await page.waitForTimeout(1500);
const testLine = await page.locator('text=/投递成功|投递失败/').count();
ok('9. test delivery result shown inline', testLine > 0);
await page.screenshot({ path: `${OUT}/b3-m8-webhook-test.png` });
log(`   screenshot -> ${OUT}/b3-m8-webhook-test.png`);

// cleanup: delete the created subscription via the trash button on its row
const row = page.locator('div:has(> div > span:text("UI 冒烟订阅"))').first();
await row.locator('button').last().click();
await page.waitForTimeout(1200);
ok('10. cleanup: subscription removed', (await page.locator('text=UI 冒烟订阅').count()) === 0);

ok('11. no console errors during the flow', consoleErrors.length === 0);
if (consoleErrors.length) consoleErrors.slice(0, 3).forEach((e) => log('   console error: ' + e));

await browser.close();
fs.writeFileSync(`${OUT}/b3-ui-report.txt`, report.join('\n'));
console.log(`\n${report.filter((l) => l.startsWith('PASS')).length}/${report.filter((l) => /^(PASS|FAIL)/.test(l)).length} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
