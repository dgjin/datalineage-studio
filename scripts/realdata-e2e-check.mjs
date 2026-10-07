// scripts/realdata-e2e-check.mjs
//
// E2E check that real backend data (not mock seeds) flows into the UI:
//   1. a temp real change event is created through the API on a collected asset,
//   2. M1 shows collected assets (names + decoded Chinese titles),
//   3. M2 renders the real lineage graph nodes around the focused asset,
//   4. M4 shows the temp event with its API-supplied rawDiff and a release note
//      generated from that event (the note used to be hardcoded mock text),
//   5. 'lineage:refresh' (fired by M11 after a collect task) forces a refetch,
//   6. after cleanup the app renders the real EMPTY change list ("暂无变更事件")
//      instead of falling back to mock events referencing non-existent assets.
//
// NOTE: uses the system Google Chrome because the bundled Playwright Chromium
// binaries crash on this macOS version (SIGBUS in the full build, renderer crash
// in headless_shell when rendering M4).
import { chromium } from 'playwright-core';
import { execFileSync } from 'child_process';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const API = 'http://localhost:8080/api/v1';
const enc = encodeURIComponent;

// ---- prepare: a temp real change event so M4 has deterministic real content ----
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
});
const authData = (await loginRes.json()).data;
const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${authData.token}` };

const RAW_DIFF = '+ qa_probe_channel VARCHAR(64) DEFAULT NULL  -- 实数据链路验证探针列';
const changeRes = await fetch(`${API}/changes`, {
  method: 'POST', headers: authHeaders,
  body: JSON.stringify({
    assetId: 'asset:dw_warehouse.dws_order_daily', assetName: 'dws_order_daily',
    changeType: 'ADD_NULLABLE_COLUMN', detectedBy: 'PROBE', isBreaking: false, isManaged: true,
    details: { column: 'qa_probe_channel', newValue: 'VARCHAR(64)', rawDiff: RAW_DIFF },
  }),
});
const tempChange = (await changeRes.json()).data;
const tempChangeId = tempChange?.id;
console.log('[prep] temp change:', tempChangeId, '| status:', tempChange?.status, '| verdict:', tempChange?.impactVerdict);

let cleanedUp = false;
// Idempotent cleanup: delete the temp change (approval_records cascade via FK)
// and its auto-gate notification so the script is re-runnable.
const cleanup = async () => {
  if (cleanedUp || !tempChangeId) return;
  cleanedUp = true;
  await fetch(`${API}/changes/${enc(tempChangeId)}`, { method: 'DELETE', headers: authHeaders }).catch(() => {});
  try {
    execFileSync('docker', ['exec', 'dl-mysql-test', 'mysql', '-uroot', '-proot123', 'datalineage',
      '-e', `DELETE FROM notifications WHERE ref_id = '${tempChangeId}';`], { stdio: 'pipe' });
  } catch { /* best-effort in constrained environments */ }
};

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// RBAC (P2-8): inject an admin session so the AuthGuard admits the app shell
await page.addInitScript((state) => {
  try { window.localStorage.setItem('dl_auth', state); } catch { /* ignore */ }
}, JSON.stringify({ token: authData.token, user: authData.user, expiresAt: Date.now() + authData.expiresInMs }));
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
  check('M1 shows real asset "ods_orders"', await page.locator('text=ods_orders').first().isVisible().catch(() => false));
  check('M1 shows decoded Chinese title "订单主表"', await page.locator('text=订单主表').first().isVisible().catch(() => false));
  check('M1 has no mojibake "å®¢"', !(await page.locator('text=å®¢').first().isVisible().catch(() => false)));

  // --- M2 lineage explorer should render the real collected graph ---
  await page.locator('text=M2 血缘探索器').first().click();
  await page.waitForTimeout(1800);
  check('M2 shows real node "dws_customer_summary"', await page.locator('text=dws_customer_summary').first().isVisible().catch(() => false));
  check('M2 shows real node "dwd_customers"', await page.locator('text=dwd_customers').first().isVisible().catch(() => false));
  check('M2 has no mojibake "å®¢"', !(await page.locator('text=å®¢').first().isVisible().catch(() => false)));
  await page.screenshot({ path: 'screenshots/m2-real-data.png' });

  // --- M4 change center should render the API-created real event ---
  await page.locator('text=M4 变更中心').first().click();
  await page.waitForTimeout(1500);
  check('M4 shows real change asset "dws_order_daily"', await page.locator('text=dws_order_daily').first().isVisible().catch(() => false));
  check('M4 shows change type "ADD_NULLABLE_COLUMN"', await page.locator('text=ADD_NULLABLE_COLUMN').first().isVisible().catch(() => false));
  check('M4 diff viewer shows API-supplied rawDiff', await page.locator('text=qa_probe_channel VARCHAR(64)').first().isVisible().catch(() => false));

  // Release note must be generated from the selected real change (was hardcoded mock)
  await page.locator('button:has-text("生成发布单")').first().click();
  await page.waitForTimeout(700);
  check('release note generated from real change (REL- id)', await page.locator('text=数据发布单 #REL-').first().isVisible().catch(() => false));
  check('mock asset "ods_crm_customer" absent while release note open', !(await page.locator('text=ods_crm_customer').first().isVisible().catch(() => false)));
  await page.getByRole('button', { name: '完成' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/m4-real-change.png' });

  // --- Real data wins over mock: a mock-only asset should not appear ---
  check('mock asset "ods_crm_customer" absent (real data wins)', !(await page.locator('text=ods_crm_customer').first().isVisible().catch(() => false)));

  // --- M11 post-collection refresh: 'lineage:refresh' forces a forced refetch ---
  const before = assetsFetches;
  await page.evaluate(() => window.dispatchEvent(new Event('lineage:refresh')));
  await page.waitForTimeout(1500);
  check('lineage:refresh event triggers new backend fetch', assetsFetches > before);

  // --- cleanup: delete the temp change (+ its auto-gate notification) ---
  await cleanup();
  const after = await (await fetch(`${API}/changes`, { headers: authHeaders })).json();
  check('temp change deleted (change list restored)', !(after.data || []).some(c => c.id === tempChangeId));

  // --- empty REAL change list must render the empty state, never mock events ---
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.locator('text=M4 变更中心').first().click();
  await page.waitForTimeout(1200);
  check('M4 empty real state shows "暂无变更事件"', await page.locator('text=暂无变更事件').first().isVisible().catch(() => false));
  check('M4 empty state shows no mock "ods_crm_customer"', !(await page.locator('text=ods_crm_customer').first().isVisible().catch(() => false)));
} catch (e) {
  console.log('E2E ABORTED:', String(e).slice(0, 300));
  results.push(['E2E completed', false]);
} finally {
  await cleanup();
}

const failed = results.filter(([, ok]) => !ok).length;
console.log(failed === 0 ? `\nALL ${results.length} CHECKS PASSED` : `\n${failed} CHECK(S) FAILED`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
