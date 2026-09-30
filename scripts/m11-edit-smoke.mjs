// One-shot smoke test of the new M11 datasource edit modal.
import { chromium } from 'playwright-core';

const EXE = process.env.HOME +
  '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route('**fonts.googleapis.com/**', (r) => r.abort());

await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });

// Navigate to M11 Data Source Manager via sidebar
await page.locator('text=M11 数据源接入').first().click();

// Wait for the "本地测试MySQL" card to appear (data loaded from backend)
const card = page.locator('div.rounded-xl', { hasText: '本地测试MySQL' });
await card.first().waitFor({ state: 'visible', timeout: 15000 });

// Click its "编辑" button
await card.first().getByRole('button', { name: '编辑' }).click();
await page.waitForTimeout(600);

// Assertions inside the modal (name inputs have no explicit type attribute)
await page.locator('.fixed h3', { hasText: '编辑数据源' }).waitFor({ state: 'visible', timeout: 5000 });
const modalTitle = await page.locator('.fixed h3', { hasText: '编辑数据源' }).count();
const nameInput = page.locator('.fixed input:not([type])').first();
const nameValue = await nameInput.inputValue();
const pwdLabel = await page.locator('label', { hasText: '留空则不修改' }).count();
const pwdValue = await page.locator('input[type="password"]').first().inputValue();
const saveBtn = await page.getByRole('button', { name: '保存' }).count();

console.log('modal title "编辑数据源":', modalTitle > 0);
console.log('name prefilled:', JSON.stringify(nameValue), nameValue === '本地测试MySQL');
console.log('password hint shown:', pwdLabel > 0);
console.log('password blank:', JSON.stringify(pwdValue), pwdValue === '');
console.log('save button (not 创建):', saveBtn > 0);

// Screenshot the modal for visual confirmation
await page.screenshot({ path: 'screenshots/m11-edit-modal.png' });
console.log('shot saved: screenshots/m11-edit-modal.png');

await browser.close();
