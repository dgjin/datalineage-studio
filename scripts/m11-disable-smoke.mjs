// M11 data source disable/enable smoke test:
// toggle a source, verify the badge/button/disabled states, the "(已停用)"
// marker on bound collect tasks, then restore the original state.
import { chromium } from 'playwright-core';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route('**fonts.googleapis.com/**', (r) => r.abort());
page.on('dialog', (d) => d.accept());

const results = [];
const check = (name, ok) => { results.push([name, !!ok]); console.log((ok ? 'PASS' : 'FAIL'), '-', name); };

try {
  await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Enter M11
  await page.locator('text=M11 数据源接入').first().click();
  await page.waitForTimeout(1500);

  const card = page.locator('div.rounded-xl').filter({ hasText: '本地测试MySQL' }).first();
  check('active source shows 停用 button', await card.getByRole('button', { name: '停用' }).isVisible().catch(() => false));

  // Disable (dialog auto-accepted)
  await card.getByRole('button', { name: '停用' }).click();
  await page.waitForTimeout(1500);

  check('card shows 已停用 badge', await card.locator('text=已停用').first().isVisible().catch(() => false));
  check('button switched to 启用', await card.getByRole('button', { name: '启用' }).isVisible().catch(() => false));
  check('测试连接 disabled when inactive', await card.getByRole('button', { name: '测试连接' }).isDisabled().catch(() => false));
  await page.screenshot({ path: 'screenshots/m11-disabled.png' });

  // Task list should mark the bound source as disabled
  await page.locator('text=采集任务 (').first().click();
  await page.waitForTimeout(800);
  check('task list marks source "(已停用)"', await page.locator('text=(已停用)').first().isVisible().catch(() => false));

  // Restore
  await page.locator('text=数据源管理 (').first().click();
  await page.waitForTimeout(600);
  await card.getByRole('button', { name: '启用' }).click();
  await page.waitForTimeout(1500);
  check('source restored to 正常 badge', await card.locator('text=正常').first().isVisible().catch(() => false));
} catch (e) {
  console.log('SMOKE ABORTED:', String(e).slice(0, 300));
  results.push(['smoke completed', false]);
}

const failed = results.filter(([, ok]) => !ok).length;
console.log(failed === 0 ? `\nALL ${results.length} CHECKS PASSED` : `\n${failed} CHECK(S) FAILED`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
