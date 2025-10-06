const { chromium } = require('playwright');

async function testFreshBrowser() {
  const browser = await chromium.launch({ headless: true });
  // Create a completely fresh context with no cache
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    javaScriptEnabled: true,
  });

  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', err => {
    errors.push(err.message);
    console.log(`💥 ERROR: ${err.message}`);
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`🔴 CONSOLE: ${msg.text()}`);
    }
  });

  try {
    console.log('🔍 Testing with fresh browser (no cache)...\n');

    // Navigate with cache bypass
    await page.goto('https://app.headspamartina.hr/audio?nocache=' + Date.now(), {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    console.log(`\n📊 Page loaded - Errors: ${errors.length}\n`);

    if (errors.length === 0) {
      console.log('✅ NO ERRORS! Testing upload button...\n');

      const uploadBtn = await page.$('button:has-text("Upload track")');
      if (uploadBtn) {
        console.log('✅ Upload button found');
        await uploadBtn.click();
        await page.waitForTimeout(2000);

        const modal = await page.$('.modal');
        if (modal) {
          console.log('✅✅✅ MODAL OPENED! BUG FIXED!\n');
          await page.screenshot({ path: '/home/admin/fleet/modal-success.png' });
        } else {
          console.log('❌ Modal still not opening (but no JS errors)\n');
          await page.screenshot({ path: '/home/admin/fleet/modal-no-open.png' });
        }
      } else {
        console.log('❌ Upload button not found');
      }
    } else {
      console.log(`❌ ${errors.length} JavaScript errors detected:\n`);
      errors.forEach(err => console.log(`   - ${err}`));
    }

  } catch (error) {
    console.error('Fatal:', error.message);
  } finally {
    await browser.close();
  }
}

testFreshBrowser().catch(console.error);
