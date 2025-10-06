const { chromium } = require('playwright');

async function testModalHandler() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let clickExecuted = false;

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}]:`, msg.text());
  });

  try {
    console.log('🔍 Testing upload modal handler\n');

    await page.goto('https://app.headspamartina.hr/audio?v=' + Date.now(), {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    console.log('✅ Page loaded with no errors\n');

    // Check if AudioModule is rendered
    const audioModule = await page.$('.audio-layout');
    console.log(`AudioModule rendered: ${!!audioModule}\n`);

    // Find upload button
    const uploadBtn = await page.$('button:has-text("Upload track")');
    if (!uploadBtn) {
      console.log('❌ Upload button NOT FOUND\n');
      await browser.close();
      return;
    }

    console.log('✅ Upload button found\n');

    // Check button properties
    const isDisabled = await uploadBtn.isDisabled();
    const isVisible = await uploadBtn.isVisible();
    console.log(`Button disabled: ${isDisabled}`);
    console.log(`Button visible: ${isVisible}\n`);

    // Inject code to monitor the click
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
                    .find(b => b.textContent.includes('Upload track'));
      if (btn) {
        console.log('Found upload button, adding listeners');
        const originalClick = btn.onclick;
        btn.onclick = (e) => {
          console.log('🎯 CLICK HANDLER CALLED!');
          if (originalClick) {
            console.log('Calling original onclick');
            return originalClick.call(btn, e);
          }
        };

        btn.addEventListener('click', () => {
          console.log('🎯 CLICK EVENT LISTENER TRIGGERED!');
        });
      } else {
        console.log('Could not find upload button');
      }
    });

    console.log('🖱️  Clicking button...\n');
    await uploadBtn.click();
    await page.waitForTimeout(2000);

    // Check for modal
    const modal = await page.$('.modal');
    if (modal) {
      console.log('✅✅✅ MODAL OPENED!\n');
    } else {
      console.log('❌ Modal did not open\n');

      // Check if uploadModalOpen variable exists in window
      const hasModalOpen = await page.evaluate(() => {
        // Try to find any element with modal class
        return {
          modalElements: document.querySelectorAll('.modal, [role="dialog"]').length,
          bodyHTML: document.body.innerHTML.includes('uploadModalOpen') ? 'YES' : 'NO'
        };
      });

      console.log('Modal elements found:', hasModalOpen.modalElements);
      console.log('uploadModalOpen in HTML:', hasModalOpen.bodyHTML);
    }

    await page.screenshot({ path: '/home/admin/fleet/modal-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved to modal-test.png');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testModalHandler().catch(console.error);
