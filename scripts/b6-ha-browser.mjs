/**
 * Batch-6 browser verification: the nginx-served SPA (docker-compose.ha.yml)
 * works end-to-end through the gateway. Requires the HA stack up on :8088:
 *   docker-compose -f docker-compose.ha.yml up -d
 *   node scripts/b6-ha-browser.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'fs';

const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const GATE = 'http://localhost:8088';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const report = [];
let failures = 0;
const log = (s) => { console.log('[HA-UI] ' + s); report.push(s); };
const ok = (name, cond) => { if (!cond) failures++; log((cond ? 'PASS  ' : 'FAIL  ') + name); return cond; };

// Login through the gateway (proves JWT issuance via nginx upstream)
const loginRes = await fetch(GATE + '/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
});
const authData = (await loginRes.json()).data;
ok('login via nginx gateway returns a token', !!authData?.token);

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
await page.addInitScript((state) => {
  try { window.localStorage.setItem('dl_auth', state); } catch { /* ignore */ }
}, JSON.stringify({ token: authData.token, user: authData.user, expiresAt: Date.now() + authData.expiresInMs }));

const seen = {};
page.on('response', (r) => {
  const u = r.url();
  if (!u.includes('/api/v1/')) return;
  const p = u.split('/api/v1/')[1].split('?')[0];
  seen[p] = r.status();
});
await page.route('**fonts.googleapis.com/**', (route) => route.abort());

await page.goto(GATE + '/', { waitUntil: 'load', timeout: 30000 });
await page.waitForSelector('text=M1 资产目录', { timeout: 20000 });
ok('sidebar renders (SPA served by nginx)', true);

// Wait for the first sync to land so /api/v1/assets is observable
await page.waitForResponse((r) => r.url().includes('/api/v1/assets') && r.status() < 500, { timeout: 15000 }).catch(() => null);
await page.waitForTimeout(1500);

ok('GET /assets through gateway = 200', seen['assets'] === 200);
const okPaths = Object.entries(seen).filter(([, s]) => s >= 200 && s < 300);
ok('no API response >= 500 through gateway', Object.values(seen).every((s) => s < 500));
ok('at least 6 gateway API paths returned 2xx (got ' + okPaths.length + ')', okPaths.length >= 6);
log('gateway API statuses: ' + JSON.stringify(seen));

await page.click('text=M1 资产目录');
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '/b6-ha-browser.png', fullPage: false });
log('screenshot: ' + OUT + '/b6-ha-browser.png');

fs.writeFileSync(OUT + '/b6-ha-browser-report.txt', report.join('\n') + '\n');
console.log('---------------------------------------------');
console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)');
await browser.close();
process.exit(failures === 0 ? 0 : 1);
