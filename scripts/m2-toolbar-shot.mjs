// One-shot screenshot of M2 Lineage Explorer toolbar to verify layout polish.
import { chromium } from 'playwright-core';

const EXE = process.env.HOME +
  '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route('**fonts.googleapis.com/**', (r) => r.abort());

// Inject an admin session (RBAC AuthGuard) before the app loads
const _dlAuth = (await (await fetch('http://localhost:8080/api/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
})).json()).data;
await page.addInitScript((state) => {
  try { window.localStorage.setItem('dl_auth', state); } catch { /* ignore */ }
}, JSON.stringify({ token: _dlAuth.token, user: _dlAuth.user, expiresAt: Date.now() + _dlAuth.expiresInMs }));

await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });

// Navigate to M2 Lineage Explorer via sidebar
await page.locator('text=M2 血缘探索器').first().click();
await page.waitForTimeout(1500);

// Capture just the toolbar area for a close look
const toolbar = page.locator('div.h-12').first();
await toolbar.screenshot({ path: 'screenshots/m2-toolbar-1440.png' });

// Also a full-page shot for overall density context
await page.screenshot({ path: 'screenshots/m2-full-1440.png' });

console.log('shots saved: screenshots/m2-toolbar-1440.png, screenshots/m2-full-1440.png');
await browser.close();
