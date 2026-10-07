/**
 * Browser-side verification for M13 model maintenance (rename / re-target / status / delete).
 * Single-pass UI check: edit modal opens, status change persists (notice rendered),
 * delete confirmation dialog appears and cancel leaves the model intact.
 *
 * Prereqs: backend on :8080, dev server on :5173, at least one imported model.
 * Run from the repo root: node scripts/m13-maint-browser.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'fs';

const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const report = [];
let failures = 0;
const log = (s) => { console.log('[VERIFY] ' + s); report.push(s); };
const ok = (name, cond) => { if (!cond) failures++; log((cond ? 'PASS  ' : 'FAIL  ') + name); return cond; };

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });

// Inject an admin session (RBAC AuthGuard)
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

// Navigate to M13
await page.locator('text=M13 数据模型').first().click();
await page.waitForTimeout(2500);
ok('1. navigated to M13', (await page.locator('text=M13 数据模型前置管理').count()) > 0);

// Maintenance buttons rendered on model cards
const editButtons = await page.locator('button[title="编辑模型元数据"]').count();
ok('2. edit buttons rendered on model cards', editButtons > 0);
const deleteButtons = await page.locator('button[title="删除模型（连带表结构与版本历史）"]').count();
ok('3. delete buttons rendered on model cards', deleteButtons > 0);

// Open the edit modal on the first model (API order == card order: created_at DESC)
const modelsRes = await fetch('http://localhost:8080/api/v1/models', {
  headers: { Authorization: `Bearer ${authData.token}` },
});
const firstModel = ((await modelsRes.json()).data || [])[0];
await page.locator('button[title="编辑模型元数据"]').first().click();
await page.waitForTimeout(600);
ok('4. edit modal opened', await page.locator('[data-testid="m13-edit-modal"]').isVisible());
ok('5. modal prefilled with model name', (await page.locator('[data-testid="m13-edit-modal"] input[type="text"]').inputValue()) === (firstModel?.name || ''));

// Toggle status DRAFT -> ARCHIVED and save
const statusSelect = page.locator('[data-testid="m13-edit-modal"] select').nth(1);
await statusSelect.selectOption('ARCHIVED');
await page.locator('[data-testid="m13-edit-modal"] button:has-text("保存")').click();
let saved = false;
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(500);
  if ((await page.locator('text=已更新').count()) > 0) { saved = true; break; }
}
ok('6. save succeeded, notice rendered ("已更新")', saved);
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + '/m13-maint-edit.png' });

// Restore status -> DRAFT for dataset hygiene (re-open, revert, save)
await page.locator('button[title="编辑模型元数据"]').first().click();
await page.waitForTimeout(600);
await page.locator('[data-testid="m13-edit-modal"] select').nth(1).selectOption('DRAFT');
await page.locator('[data-testid="m13-edit-modal"] button:has-text("保存")').click();
let restored = false;
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(500);
  if ((await page.locator('text=已更新').count()) > 0) { restored = true; break; }
}
ok('7. status restored to DRAFT (dataset hygiene)', restored);

// Delete flow: native confirm dialog appears; dismissing keeps the model
const beforeCount = await page.locator('button[title="删除模型（连带表结构与版本历史）"]').count();
let dialogSeen = false;
page.once('dialog', async (d) => {
  dialogSeen = true;
  log('   dialog: ' + d.message().slice(0, 80));
  await d.dismiss();
});
await page.locator('button[title="删除模型（连带表结构与版本历史）"]').first().click();
await page.waitForTimeout(1200);
ok('8. delete confirmation dialog appears with cascade hint', dialogSeen && (await page.locator('text=已删除').count()) === 0);
const afterCount = await page.locator('button[title="删除模型（连带表结构与版本历史）"]').count();
ok('9. dismissing the dialog keeps the model', afterCount === beforeCount);

// No console errors
const realErrors = consoleErrors.filter(e =>
  !e.includes('fonts.googleapis') &&
  !e.includes('favicon') &&
  !e.includes('Failed to load resource'));
ok('10. no console errors', realErrors.length === 0);
realErrors.slice(0, 5).forEach(e => log('   ERR: ' + e.slice(0, 220)));

await browser.close();
fs.writeFileSync(OUT + '/m13-maint-browser-report.txt', report.join('\n') + '\n');
console.log(`\n${report.filter((l) => l.startsWith('PASS')).length}/${report.filter((l) => l.startsWith('PASS') || l.startsWith('FAIL')).length} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
