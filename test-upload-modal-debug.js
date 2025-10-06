const { chromium } = require('playwright');

async function debugUploadModal() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  const warnings = [];
  const logs = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();

    if (type === 'error') {
      errors.push(text);
      console.log(`🔴 ERROR: ${text}`);
    } else if (type === 'warning') {
      warnings.push(text);
      console.log(`⚠️  WARN: ${text}`);
    } else {
      logs.push(text);
    }
  });

  page.on('pageerror', err => {
    errors.push(err.message);
    console.log(`💥 PAGE ERROR: ${err.message}`);
  });

  try {
    console.log('\n🔍 DEBUGGING UPLOAD MODAL\n');

    await page.goto('https://app.headspamartina.hr/audio', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log('\n✅ Page loaded\n');

    // Take screenshot before click
    await page.screenshot({ path: '/home/admin/fleet/debug-before-click.png', fullPage: true });

    // Find upload button
    const uploadBtn = await page.$('button:has-text("Upload track")');
    if (!uploadBtn) {
      console.log('❌ Upload button not found!');
      await browser.close();
      return;
    }

    console.log('✅ Upload button found\n');

    // Check if button is enabled
    const isDisabled = await uploadBtn.isDisabled();
    console.log(`   Disabled: ${isDisabled}`);

    // Check button HTML
    const btnHTML = await uploadBtn.evaluate(el => el.outerHTML);
    console.log(`   HTML: ${btnHTML.substring(0, 200)}\n`);

    // Click button
    console.log('🖱️  Clicking Upload button...\n');
    await uploadBtn.click();
    await page.waitForTimeout(3000);

    // Check for modal
    const modal = await page.$('.modal');
    console.log(`   Modal exists: ${!!modal}`);

    if (modal) {
      console.log('   ✅ Modal appeared!');
      const modalHTML = await modal.evaluate(el => el.outerHTML);
      console.log(`   Modal HTML (first 500 chars): ${modalHTML.substring(0, 500)}`);
    } else {
      console.log('   ❌ Modal did NOT appear');

      // Check if uploadModalOpen variable exists
      const checkState = await page.evaluate(() => {
        // Try to find any Svelte component state
        const buttons = document.querySelectorAll('button');
        return {
          buttonCount: buttons.length,
          hasModal: !!document.querySelector('.modal'),
          bodyHTML: document.body.innerHTML.length
        };
      });

      console.log(`\n   State check:`, checkState);
    }

    // Take screenshot after click
    await page.screenshot({ path: '/home/admin/fleet/debug-after-click.png', fullPage: true });

    console.log(`\n📊 Summary:`);
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Warnings: ${warnings.length}`);

    if (errors.length > 0) {
      console.log(`\n🔴 Errors found:`);
      errors.forEach(err => console.log(`   - ${err}`));
    }

  } catch (error) {
    console.error('\n💥 Fatal Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugUploadModal().catch(console.error);
