// scripts/demo-mode-check.mjs
//
// E2E check for the one-click demo-data switch:
//   1. a fresh browser profile defaults to OFF (quasi-production): real backend
//      data renders (real asset "ods_orders", real contract) and no demo/mock
//      content leaks ("ods_crm_customer" / bundled contract absent),
//   2. one click on the header toggle switches to demo mode: the bundled dataset
//      renders in M1/M6, the state persists across reload (localStorage
//      dl_demo_mode = 1),
//   3. a second click returns to quasi-production, and the script leaves the
//      persisted flag OFF so the next session stays in the default mode.
//
// NOTE: uses the system Google Chrome because the bundled Playwright Chromium
// binaries crash on this macOS version.
import { chromium } from 'playwright-core';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await chromium.launch({ executablePath: EXE, headless: true });
// Fresh context => fresh localStorage: verifies the default (OFF) behavior first
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route('**fonts.googleapis.com/**', (r) => r.abort());

// RBAC (AuthGuard): inject an admin session before the app loads
const _dlAuth = (await (await fetch('http://localhost:8080/api/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
})).json()).data;
await page.addInitScript((state) => {
  try { window.localStorage.setItem('dl_auth', state); } catch { /* ignore */ }
}, JSON.stringify({ token: _dlAuth.token, user: _dlAuth.user, expiresAt: Date.now() + _dlAuth.expiresInMs }));

const results = [];
const check = (name, ok) => { results.push([name, !!ok]); console.log((ok ? 'PASS' : 'FAIL'), '-', name); };
const readFlag = () => page.evaluate(() => window.localStorage.getItem('dl_demo_mode'));
const demoBtn = () => page.locator('header button').filter({ hasText: '演示数据' }).first();

try {
  await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500); // allow mount-time backend fetch

  // --- 1. default OFF: quasi-production, real data only ---
  check('fresh session persists dl_demo_mode=0 (default OFF)', (await readFlag()) === '0');
  check('header toggle shows plain 演示数据 (OFF)', !(await demoBtn().innerText()).includes('ON'));

  await page.locator('text=M1 资产目录').first().click();
  await page.waitForTimeout(900);
  check('OFF renders real asset "ods_orders"', await page.locator('text=ods_orders').first().isVisible().catch(() => false));
  check('OFF leaks no demo asset "ods_crm_customer"', !(await page.locator('text=ods_crm_customer').first().isVisible().catch(() => false)));

  await page.locator('text=M6 契约建模').first().click();
  await page.waitForTimeout(900);
  check('OFF shows real contract "dws_customer_summary.yaml"', await page.locator('text=dws_customer_summary.yaml').first().isVisible().catch(() => false));
  check('OFF hides bundled demo contract "contracts/crm/customer.yaml"', !(await page.locator('text=contracts/crm/customer.yaml').first().isVisible().catch(() => false)));

  // --- 2. one click -> demo mode ON ---
  await demoBtn().click();
  await page.waitForTimeout(600);
  check('click switches flag to dl_demo_mode=1', (await readFlag()) === '1');
  check('header toggle shows 演示数据 ON', (await demoBtn().innerText()).includes('ON'));

  await page.locator('text=M1 资产目录').first().click();
  await page.waitForTimeout(900);
  check('ON renders bundled demo asset "ods_crm_customer"', await page.locator('text=ods_crm_customer').first().isVisible().catch(() => false));
  await page.screenshot({ path: 'screenshots/demo-mode-on.png' });

  await page.locator('text=M6 契约建模').first().click();
  await page.waitForTimeout(900);
  check('ON shows bundled demo contract "contracts/crm/customer.yaml"', await page.locator('text=contracts/crm/customer.yaml').first().isVisible().catch(() => false));

  // --- 3. reload keeps demo mode (persistence) ---
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  check('reload keeps dl_demo_mode=1', (await readFlag()) === '1');
  check('reload keeps 演示数据 ON', (await demoBtn().innerText()).includes('ON'));
  await page.locator('text=M1 资产目录').first().click();
  await page.waitForTimeout(900);
  check('reload still renders bundled demo asset', await page.locator('text=ods_crm_customer').first().isVisible().catch(() => false));

  // --- 4. second click -> back to quasi-production ---
  await demoBtn().click();
  await page.waitForTimeout(600);
  check('click back switches flag to dl_demo_mode=0', (await readFlag()) === '0');
  check('header toggle back to plain 演示数据', !(await demoBtn().innerText()).includes('ON'));
  check('OFF again renders real asset "ods_orders"', await page.locator('text=ods_orders').first().isVisible().catch(() => false));
  check('OFF again hides demo asset', !(await page.locator('text=ods_crm_customer').first().isVisible().catch(() => false)));
  await page.screenshot({ path: 'screenshots/demo-mode-off.png' });
} catch (e) {
  console.log('CHECK ABORTED:', String(e).slice(0, 300));
  results.push(['demo-mode check completed', false]);
}

const failed = results.filter(([, ok]) => !ok).length;
console.log(failed === 0 ? `\nALL ${results.length} CHECKS PASSED` : `\n${failed} CHECK(S) FAILED`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
