const { chromium } = require('playwright');
const fs = require('fs');

async function testUploadButton() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}]:`, msg.text());
  });

  const apiCalls = [];

  page.on('response', async res => {
    if (res.url().includes('/audio/library')) {
      apiCalls.push({
        method: res.request().method(),
        url: res.url().replace('https://app.headspamartina.hr', ''),
        status: res.status()
      });
    }
  });

  try {
    console.log('🔍 Testing upload submit button\n');

    await page.goto('https://app.headspamartina.hr/audio?v=' + Date.now(), {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    console.log('✅ Page loaded\n');

    // Click Upload track button to open modal
    const uploadTrackBtn = await page.$('button:has-text("Upload track")');
    if (!uploadTrackBtn) {
      console.log('❌ Upload track button not found');
      await browser.close();
      return;
    }

    console.log('📤 Clicking Upload track button...');
    await uploadTrackBtn.click();
    await page.waitForTimeout(1000);

    // Check if modal opened
    const modal = await page.$('.modal[role="dialog"]');
    if (!modal) {
      console.log('❌ Modal did not open');
      await browser.close();
      return;
    }

    console.log('✅ Modal opened\n');

    // Create test audio file
    const testAudioPath = '/tmp/test-upload.mp3';
    const mp3Header = Buffer.from([
      0xFF, 0xFB, 0x90, 0x00, // MP3 header
      ...Array(1000).fill(0x00)
    ]);
    fs.writeFileSync(testAudioPath, mp3Header);

    // Fill the form
    console.log('📝 Filling form...');
    await page.setInputFiles('input[type="file"]', testAudioPath);
    await page.fill('input[placeholder*="title" i]', 'Test Upload');
    await page.fill('input[placeholder*="artist" i]', 'Test Artist');
    await page.waitForTimeout(500);

    console.log('✅ Form filled\n');

    // Find and click Upload button inside modal
    console.log('🔍 Looking for Upload button in modal...');
    const uploadButton = await page.$('.modal button:has-text("Upload")');

    if (!uploadButton) {
      console.log('❌ Upload button not found in modal');
      await page.screenshot({ path: '/home/admin/fleet/upload-button-test.png', fullPage: true });
      await browser.close();
      return;
    }

    console.log('✅ Found Upload button');

    // Check button properties
    const isDisabled = await uploadButton.isDisabled();
    const isVisible = await uploadButton.isVisible();
    console.log(`   Disabled: ${isDisabled}`);
    console.log(`   Visible: ${isVisible}\n`);

    // Add click listener debugging
    await page.evaluate(() => {
      const uploadBtn = Array.from(document.querySelectorAll('.modal button'))
                          .find(b => b.textContent?.includes('Upload'));
      if (uploadBtn) {
        console.log('🎯 Found button in DOM, adding debug listener');
        uploadBtn.addEventListener('click', () => {
          console.log('🎯 UPLOAD BUTTON CLICKED!');
        }, { capture: true });
      }
    });

    console.log('🖱️  Clicking Upload button...');
    await uploadButton.click();
    await page.waitForTimeout(3000);

    console.log('\n📡 API Calls:');
    if (apiCalls.length === 0) {
      console.log('   ❌ No upload API calls detected');
    } else {
      apiCalls.forEach(call => {
        const icon = call.status >= 200 && call.status < 300 ? '✅' : '❌';
        console.log(`   ${icon} ${call.method} ${call.url} → ${call.status}`);
      });
    }

    // Check if modal is still open
    const modalStillOpen = await page.$('.modal[role="dialog"]');
    if (modalStillOpen) {
      console.log('\n❌ Modal still open (upload may have failed)');

      // Check for error message
      const errorMsg = await page.$('.form-error');
      if (errorMsg) {
        const errorText = await errorMsg.textContent();
        console.log(`   Error: ${errorText}`);
      }
    } else {
      console.log('\n✅ Modal closed (upload likely succeeded)');
    }

    await page.screenshot({ path: '/home/admin/fleet/upload-button-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testUploadButton().catch(console.error);
