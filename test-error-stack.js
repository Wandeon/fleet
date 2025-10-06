const { chromium } = require('playwright');

async function captureErrorStack() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('pageerror', err => {
    console.log('💥 PAGE ERROR:');
    console.log(`   Message: ${err.message}`);
    console.log(`   Stack: ${err.stack}`);
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`🔴 CONSOLE ERROR: ${msg.text()}`);
    }
  });

  try {
    await page.goto('https://app.headspamartina.hr/audio', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log('✅ Page loaded, waiting for errors...');
    await page.waitForTimeout(2000);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

captureErrorStack().catch(console.error);
