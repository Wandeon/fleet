const { chromium } = require('playwright');

async function testDataState() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://app.headspamartina.hr/audio?v=' + Date.now(), {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    console.log('✅ Page loaded\n');

    // Check component structure
    const dataCheck = await page.evaluate(() => {
      // Find AudioModule in the page
      const audioModule = document.querySelector('.audio-layout');
      const uploadBtn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.includes('Upload track'));

      return {
        audioModuleExists: !!audioModule,
        uploadButtonExists: !!uploadBtn,
        uploadButtonParent: uploadBtn?.closest('section')?.className || 'N/A',
        allModals: document.querySelectorAll('.modal').length,
        audioSections: document.querySelectorAll('.audio-layout section').length
      };
    });

    console.log('Component Structure:');
    console.log(`  AudioModule rendered: ${dataCheck.audioModuleExists}`);
    console.log(`  Upload button exists: ${dataCheck.uploadButtonExists}`);
    console.log(`  Button parent section: ${dataCheck.uploadButtonParent}`);
    console.log(`  Modal elements: ${dataCheck.allModals}`);
    console.log(`  Audio sections: ${dataCheck.audioSections}\n`);

    // Now click and check state change
    console.log('Clicking Upload track button...\n');
    const uploadBtn = await page.$('button:has-text("Upload track")');
    await uploadBtn.click();
    await page.waitForTimeout(2000);

    const afterClick = await page.evaluate(() => {
      return {
        modalsAfterClick: document.querySelectorAll('.modal').length,
        bodyContainsModal: document.body.innerHTML.includes('class="modal"'),
        uploadModalOpen: document.body.innerHTML.includes('uploadModalOpen'),
      };
    });

    console.log('After Click:');
    console.log(`  Modals rendered: ${afterClick.modalsAfterClick}`);
    console.log(`  Body contains modal class: ${afterClick.bodyContainsModal}`);
    console.log(`  uploadModalOpen in HTML: ${afterClick.uploadModalOpen}\n`);

    if (afterClick.modalsAfterClick === 0) {
      console.log('❌ Modal did not render\n');
      console.log('Possible causes:');
      console.log('  1. uploadModalOpen state not changing');
      console.log('  2. Modal template not being evaluated');
      console.log('  3. AudioModule not fully hydrated');
    } else {
      console.log('✅ Modal rendered successfully!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testDataState().catch(console.error);
