// One-shot diagnosis: measure toolbar overflow across common viewport widths.
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
await page.locator('text=M2 血缘探索器').first().click();
await page.waitForTimeout(1200);

for (const w of [1280, 1366, 1440, 1512, 1728]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const bar = document.querySelector('div.h-12');
    if (!bar) return null;
    const kids = [...bar.children].map((el) => {
      const r = el.getBoundingClientRect();
      return { cls: el.className.slice(0, 40), left: Math.round(r.left), width: Math.round(r.width), right: Math.round(r.right) };
    });
    const br = bar.getBoundingClientRect();
    const last = kids[kids.length - 1];
    return {
      viewport: window.innerWidth,
      barWidth: Math.round(br.width),
      scrollWidth: bar.scrollWidth,
      overflow: bar.scrollWidth - bar.clientWidth,
      kids,
      lastRightVsBarRight: last.right - Math.round(br.right),
    };
  });
  console.log(JSON.stringify(m, null, 1));
  console.log('-----');
}
await browser.close();
