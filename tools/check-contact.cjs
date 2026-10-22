// Usage: node tools/check-contact.cjs [path/to/live-candidate/index.html]
// Install Playwright and Chromium in your test environment. No real external requests are made.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const legacy = path.resolve(__dirname, '../index.html.html');
  const files = [legacy, ...(process.argv[2] ? [path.resolve(process.argv[2])] : [])];
  try {
    for (const file of files) {
      for (const width of [360, 390, 768, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 } });
        const posts = [];
        await context.route('**/*', route => {
          if (route.request().method() === 'POST') posts.push(route.request().url());
          if (new URL(route.request().url()).hostname === 'clinic.test') return route.fulfill({ body: fs.readFileSync(file), contentType: 'text/html; charset=utf-8' });
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto('https://clinic.test/?sent=1');
        if (file === legacy) await page.evaluate(() => showPage('contact'));
        const card = page.locator('[aria-labelledby="contact-options-title"]');
        await card.scrollIntoViewIfNeeded();
        assert.equal(await card.locator('form,input,textarea,button').count(), 0);
        const link = page.locator('#contact-whatsapp');
        const url = new URL(await link.getAttribute('href'));
        assert.equal(url.origin + url.pathname, 'https://wa.me/972545206037');
        assert.equal(url.searchParams.get('text'), 'שלום שני, אשמח לתאם שיחת היכרות.');
        assert.equal(await page.locator('#contact-phone').getAttribute('href'), 'tel:+972545206037');
        assert(!/הפנייה נשלחה!|הפרטים התקבלו בהצלחה/.test(await page.locator('body').innerText()));
        assert(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        await link.focus();
        const popupPromise = context.waitForEvent('page');
        await page.keyboard.press('Enter');
        const popup = await popupPromise; await popup.close();
        assert(!/הפנייה נשלחה!|הפרטים התקבלו בהצלחה/.test(await page.locator('body').innerText()));
        assert.equal(posts.length, 0);
        console.log(`${path.basename(file)} ${width}px: passed`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
