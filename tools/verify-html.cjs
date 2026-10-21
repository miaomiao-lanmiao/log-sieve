const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.LOGSIEVE_PLAYWRIGHT_PATH || 'playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch({ channel: 'msedge', headless: true, chromiumSandbox: true });
  try {
    const context = await browser.newContext({ acceptDownloads: false, permissions: [], serviceWorkers: 'block', viewport: { width: 1280, height: 960 } });
    const external = [];
    const errors = [];
    await context.route('**/*', route => {
      if (new URL(route.request().url()).protocol === 'file:') return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, 'examples/report.html')).href);
    assert.equal(await page.locator('article').count(), 3);
    assert.equal(await page.locator('script,iframe,img').count(), 0);
    assert.ok(!(await page.locator('body').innerText()).includes('synthetic-demo-'));
    fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'reports/desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(root, 'reports/mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('HTML verified in Edge: three groups, no active/external content, no fixture credentials, no mobile overflow.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
