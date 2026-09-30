// One-shot E2E acceptance: real collected data (assets / edges / change events)
// flows into the UI modules (M1 catalog, M2 lineage, M4 change center), and the
// 'lineage:refresh' event (fired by M11 after running a collect task) forces a
// backend refetch.
//
// NOTE: uses the system Google Chrome because the bundled Playwright Chromium
// binaries crash on this macOS version (SIGBUS in the full build, renderer crash
// in headless_shell when rendering M4).
import { chromium } from 'playwright-core';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route('**fonts.googleapis.com/**', (r) => r.abort());

let assetsFetches = 0;
page.on('request', (r) => { if (r.url().includes('/api/v1/assets')) assetsFetches++; });

const results = [];
const check = (name, ok) => { results.push([name, !!ok]); console.log((ok ? 'PASS' : 'FAIL'), '-', name); };

try {
  await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500); // allow mount-time backend fetch

  // --- M1 asset catalog should list real collected assets ---
  await page.locator('text=M1 资产目录').first().click();
  await page.waitForTimeout(900);
  check('M1 shows real asset "customers"', await page.locator('text=customers').first().isVisible().catch(() => false));
  check('M1 shows decoded Chinese title "客户主表"', await page.locator('text=客户主表').first().isVisible().catch(() => false));
  check('M1 has no mojibake "å®¢"', !(await page.locator('text=å®¢').first().isVisible().catch(() => false)));

  // --- M2 lineage explorer should render the real FK + view-dependency lineage ---
  await page.locator('text=M2 血缘探索器').first().click();
  await page.waitForTimeout(1800);
  check('M2 shows real node "order_summary"', await page.locator('text=order_summary').first().isVisible().catch(() => false));
  check('M2 shows real node "customers"', await page.locator('text=customers').first().isVisible().catch(() => false));
  check('M2 has no mojibake "å®¢"', !(await page.locator('text=å®¢').first().isVisible().catch(() => false)));
  await page.screenshot({ path: 'screenshots/m2-real-data.png' });

  // --- M4 change center should show the collected drift events with raw DDL diff ---
  await page.locator('text=M4 变更中心').first().click();
  await page.waitForTimeout(1500);
  check('M4 shows real change column "remark"', await page.locator('text=remark').first().isVisible().catch(() => false));
  check('M4 shows real change asset "order_summary"', await page.locator('text=order_summary').first().isVisible().catch(() => false));
  check('M4 diff viewer shows generated rawDiff', await page.getByText('MODIFY COLUMN amount DECIMAL(16)').first().isVisible().catch(() => false));
  await page.screenshot({ path: 'screenshots/m4-real-change.png' });

  // --- Real data wins over mock: a mock-only asset should not appear ---
  check('mock asset "ods_crm_customer" absent (real data wins)', !(await page.locator('text=ods_crm_customer').first().isVisible().catch(() => false)));

  // --- M11 post-collection refresh: 'lineage:refresh' forces a forced refetch ---
  const before = assetsFetches;
  await page.evaluate(() => window.dispatchEvent(new Event('lineage:refresh')));
  await page.waitForTimeout(1500);
  check('lineage:refresh event triggers new backend fetch', assetsFetches > before);
} catch (e) {
  console.log('E2E ABORTED:', String(e).slice(0, 300));
  results.push(['E2E completed', false]);
}

const failed = results.filter(([, ok]) => !ok).length;
console.log(failed === 0 ? `\nALL ${results.length} CHECKS PASSED` : `\n${failed} CHECK(S) FAILED`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
