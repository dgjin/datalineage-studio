/**
 * Deep verification for P2-8 RBAC (Spring Security + JWT, ADMIN / GOVERNOR / VIEWER).
 * Uses playwright-core with the locally cached chrome-headless-shell.
 *
 * Prereqs: backend on :8080 (JWT auth + RBAC), dev server on :5173.
 */
import { chromium } from 'playwright-core';
import fs from 'fs';

const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const report = [];
const log = (s) => { console.log('[VERIFY] ' + s); report.push(s); };
const ok = (name, cond) => { log((cond ? 'PASS  ' : 'FAIL  ') + name); return cond; };

const API = 'http://localhost:8080/api/v1';

// ---------- API layer ----------
const login = async (u, p) => {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p }),
  });
  const j = await r.json();
  return { status: r.status, data: j.data, message: j.message };
};
const putReadAll = (token) =>
  fetch(`${API}/notifications/read-all`, {
    method: 'PUT',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((r) => r.status);

const adminLogin = await login('admin', 'admin123');
ok('A1. admin login -> 200 + 8h token', adminLogin.status === 200 && !!adminLogin.data?.token && adminLogin.data?.expiresInMs === 28800000);
ok('A2. admin role ADMIN (林浩然)', adminLogin.data?.user?.role === 'ADMIN' && adminLogin.data?.user?.displayName === '林浩然');
const governorLogin = await login('governor', 'governor123');
ok('A3. governor login -> 200 (GOVERNOR)', governorLogin.status === 200 && governorLogin.data?.user?.role === 'GOVERNOR');
const viewerLogin = await login('viewer', 'viewer123');
ok('A4. viewer login -> 200 (VIEWER)', viewerLogin.status === 200 && viewerLogin.data?.user?.role === 'VIEWER');
const badLogin = await login('admin', 'wrong-password');
ok('A5. wrong password rejected (400)', badLogin.status === 400);

ok('A6. write without token -> 401', (await putReadAll(null)) === 401);
ok('A7. viewer write -> 403', (await putReadAll(viewerLogin.data.token)) === 403);
ok('A8. governor write -> 200', (await putReadAll(governorLogin.data.token)) === 200);
ok('A9. admin write -> 200', (await putReadAll(adminLogin.data.token)) === 200);
ok('A10. GET stays public -> 200', (await fetch(`${API}/assets?limit=1`).then((r) => r.status)) === 200);

// ---------- Browser layer ----------
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

await page.route('**fonts.googleapis.com/**', (r) => r.abort());
await page.route('**fonts.gstatic.com/**', (r) => r.abort());

await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2500);

// 1. anonymous visitor is gated by the login screen
ok('B1. login gate renders for anonymous visitor', (await page.locator('text=登录控制台').count()) > 0);
ok('B2. three demo accounts offered', (await page.locator('text=演示账号一键登录').count()) > 0);
await page.screenshot({ path: OUT + '/auth-1-login.png' });

// 2. one-click viewer login
await page.locator('button:has-text("苏婉清")').first().click();
await page.waitForTimeout(3500);
ok('B3. viewer enters the app shell', (await page.locator('text=M10 采集与管理').count()) > 0);
ok('B4. viewer session badge in header', (await page.locator('header button:has-text("苏婉清")').count()) > 0);

// 3. viewer is read-only in M10
await page.locator('text=M10 采集与管理').first().click();
await page.waitForTimeout(2000);
const locked = page.locator('button:has-text("只读"):not(:has-text("观察员"))');
ok('B5. viewer sees exactly 3 locked run buttons', (await locked.count()) === 3);
ok('B6. locked button is disabled', (await locked.count()) > 0 && (await locked.first().isDisabled()));
await page.screenshot({ path: OUT + '/auth-2-viewer-readonly.png' });

// 4. viewer write through the browser session -> 403
const viewerWrite = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/notifications/read-all', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
  return r.status;
}, viewerLogin.data.token);
ok('B7. viewer write via browser context -> 403', viewerWrite === 403);

// 5. logout via the header badge menu
await page.locator('header button:has-text("苏婉清")').click();
await page.waitForTimeout(400);
await page.locator('button:has-text("退出登录")').click();
await page.waitForTimeout(1000);
ok('B8. logout returns to the login gate', (await page.locator('text=登录控制台').count()) > 0);

// 6. one-click admin login, write enabled
await page.locator('button:has-text("林浩然")').first().click();
await page.waitForTimeout(3500);
ok('B9. admin enters the app shell', (await page.locator('text=M10 采集与管理').count()) > 0);
ok('B10. admin session badge in header', (await page.locator('header button:has-text("林浩然")').count()) > 0);
await page.locator('text=M10 采集与管理').first().click();
await page.waitForTimeout(2000);
const runBtns = await page.locator('button:has-text("立即采集")').count();
ok('B11. admin sees exactly 3 enabled run buttons', runBtns === 3);
ok('B12. run button enabled for admin', runBtns > 0 && (await page.locator('button:has-text("立即采集")').first().isEnabled()));
await page.screenshot({ path: OUT + '/auth-3-admin-write.png' });

// 7. admin write through the browser session -> 200
const adminWrite = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/notifications/read-all', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
  return r.status;
}, adminLogin.data.token);
ok('B13. admin write via browser context -> 200', adminWrite === 200);

// 8. tampered token is rejected by protected endpoint
const tamperedStatus = await page.evaluate(async () => {
  const raw = JSON.parse(localStorage.getItem('dl_auth'));
  const bad = raw.token.slice(0, -6) + 'AAAAAA';
  const r = await fetch('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + bad } });
  return r.status;
});
ok('B14. tampered token rejected by /auth/me -> 401', tamperedStatus === 401);

// console errors
const realErrors = consoleErrors.filter((e) =>
  !e.includes('fonts.googleapis') &&
  !e.includes('favicon') &&
  !e.includes('Failed to load resource') &&
  !e.includes('401') && !e.includes('403'));
ok('C1. no console errors', realErrors.length === 0);
realErrors.slice(0, 5).forEach((e) => log('   ERR: ' + e.slice(0, 220)));

fs.writeFileSync(OUT + '/auth-verify-report.txt', report.join('\n'));
await browser.close();
console.log('DONE');
