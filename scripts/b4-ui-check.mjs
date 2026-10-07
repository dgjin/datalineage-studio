/**
 * Batch-4 UI verification: first-sync skeletons (M1/M2) + ErrorBoundary.
 * Requires vite :5173 and backend :8080 running. Run from the repo root:
 *   node scripts/b4-ui-check.mjs
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

// Crash-test errors are expected once the deliberate Bomber throw fires.
// Known noise: before the first real sync lands, GovernanceHealthPanel probes
// /dashboard/asset-health with the mock seed id (asset:ods_crm_customer), which
// does not exist in the backend -> one 400 that the component already swallows.
const consoleErrors = [];
const expectedError = (t) => t.includes('boom-from-test') || t.includes('ErrorBoundary') || t.includes('The above error');
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (expectedError(m.text())) return;
  const loc = m.location()?.url || '';
  if (m.text().includes('Failed to load resource') && loc.includes('/dashboard/asset-health/asset:ods_crm_customer')) {
    log('   known probe 400 ignored: ' + loc);
    return;
  }
  consoleErrors.push(m.text() + ' @ ' + loc);
});
page.on('response', (r) => { if (r.status() >= 400) log('   HTTP ' + r.status() + ' ' + r.request().method() + ' ' + r.url()); });

// Throttle the first-sync APIs so the skeletons stay visible long enough to assert
const SLOW_MS = 3500;
for (const pattern of ['**/api/v1/assets**', '**/api/v1/lineage/**', '**/api/v1/changes**']) {
  await page.route(pattern, async (route) => {
    await new Promise((r) => setTimeout(r, SLOW_MS));
    await route.continue();
  });
}

// ---------- 1. M1 asset-list skeleton during the first sync ----------
await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForSelector('text=M1 资产目录', { timeout: 15000 });
await page.locator('text=M1 资产目录').first().click();
await page.waitForTimeout(400);
ok('1. M1 asset skeleton visible during first sync', await page.locator('[data-testid="asset-list-skeleton"]').first().isVisible());
await page.screenshot({ path: `${OUT}/b4-m1-asset-skeleton.png` });
log(`   screenshot -> ${OUT}/b4-m1-asset-skeleton.png`);
await page.waitForTimeout(SLOW_MS + 1500);
ok('2. asset skeleton gone after sync', (await page.locator('[data-testid="asset-list-skeleton"]').count()) === 0);
ok('3. real asset table rendered', await page.locator('text=资产名称 / 标题').first().isVisible());

// ---------- 2. M2 graph skeleton during the first sync ----------
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('text=M2 血缘探索器', { timeout: 15000 });
await page.locator('text=M2 血缘探索器').first().click();
await page.waitForTimeout(400);
ok('4. M2 graph skeleton visible during first sync', await page.locator('[data-testid="graph-skeleton"]').first().isVisible());
await page.screenshot({ path: `${OUT}/b4-m2-graph-skeleton.png` });
log(`   screenshot -> ${OUT}/b4-m2-graph-skeleton.png`);
await page.waitForTimeout(SLOW_MS + 1500);
ok('5. graph skeleton gone after sync', (await page.locator('[data-testid="graph-skeleton"]').count()) === 0);
ok('6. lineage swimlanes rendered', await page.locator('text=/ODS 层/').first().isVisible());

// ---------- 3. ErrorBoundary: crash isolation + retry recovery ----------
await page.evaluate(async () => {
  const React = (await import('/node_modules/.vite/deps/react.js')).default;
  const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
  const { ErrorBoundary } = await import('/src/components/ErrorBoundary.tsx');
  const container = document.createElement('div');
  container.id = 'eb-test-root';
  container.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#020617;overflow:auto;';
  document.body.appendChild(container);
  let shouldCrash = true;
  window.__ebSetCrash = (v) => { shouldCrash = v; };
  const Bomber = () => {
    if (shouldCrash) throw new Error('boom-from-test');
    return React.createElement('div', { id: 'eb-recovered' }, 'BOUNDARY-RECOVERED');
  };
  const createRoot = ReactDOM.createRoot || ReactDOM.default.createRoot;
  createRoot(container).render(
    React.createElement(ErrorBoundary, { label: 'test-bomb', className: 'h-full w-full' },
      React.createElement(Bomber)),
  );
});
await page.waitForSelector('text=/模块渲染异常/', { timeout: 5000 });
ok('7. crash isolated by ErrorBoundary (fallback shown)', true);
ok('8. fallback shows the real error message', await page.locator('text=boom-from-test').first().isVisible());
ok('9. retry button rendered', await page.locator('button:has-text("重试渲染")').first().isVisible());
await page.screenshot({ path: `${OUT}/b4-error-boundary.png` });
log(`   screenshot -> ${OUT}/b4-error-boundary.png`);

await page.evaluate(() => { window.__ebSetCrash(false); });
await page.locator('button:has-text("重试渲染")').first().click();
await page.waitForSelector('#eb-recovered', { timeout: 5000 });
ok('10. retry recovers the subtree', true);

// cleanup the crash-test mount
await page.evaluate(() => { document.getElementById('eb-test-root')?.remove(); });

ok('11. no unexpected console errors', consoleErrors.length === 0);
if (consoleErrors.length) consoleErrors.slice(0, 3).forEach((e) => log('   console error: ' + e));

await browser.close();
fs.writeFileSync(`${OUT}/b4-ui-report.txt`, report.join('\n'));
console.log(`\n${report.filter((l) => l.startsWith('PASS')).length}/${report.filter((l) => /^(PASS|FAIL)/.test(l)).length} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
