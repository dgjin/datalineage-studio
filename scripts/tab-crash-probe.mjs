/** Cross-module renderer crash probe: clicks through tabs, logs which one kills the renderer. */
import { chromium } from 'playwright-core';

const EXE = process.env.SMOKE_CHROME || (process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell');

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
page.on('crash', () => console.log('[CRASH] renderer crashed'));
page.on('pageerror', (e) => console.log('[pageerror] ' + String(e.message).slice(0, 200)));

await page.route('**fonts.googleapis.com/**', (r) => r.abort());
await page.route('**fonts.gstatic.com/**', (r) => r.abort());

// Inject an admin session (RBAC AuthGuard) before the app loads
const _dlAuth = (await (await fetch('http://localhost:8080/api/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
})).json()).data;
await page.addInitScript((state) => {
  try { window.localStorage.setItem('dl_auth', state); } catch { /* ignore */ }
}, JSON.stringify({ token: _dlAuth.token, user: _dlAuth.user, expiresAt: Date.now() + _dlAuth.expiresInMs }));

await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2500);
console.log('[probe] home loaded');

const tabs = process.argv[2] ? [process.argv[2]] : ['M2 血缘探索器', 'M3 影响分析', 'M5 指标中心', 'M6 契约建模', 'M7 校验中心', 'M8 通知中心', 'M1 资产目录', 'M10 采集与管理', 'M4 变更中心'];

for (const t of tabs) {
  try {
    await page.locator(`text=${t}`).first().click();
    await page.waitForTimeout(1600);
    const bodyLen = (await page.locator('body').innerText()).length;
    console.log(`[probe] ${t} -> ALIVE (text ${bodyLen} chars)`);
  } catch (e) {
    console.log(`[probe] ${t} -> CRASHED: ${String(e).slice(0, 120)}`);
    process.exit(1);
  }
}
console.log('[probe] ALL TABS OK');
await browser.close();
