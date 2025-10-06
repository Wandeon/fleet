const { chromium } = require('playwright');

async function testDeviceControls() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const apiCalls = [];

  page.on('response', async res => {
    if (res.url().includes('/audio/devices/')) {
      apiCalls.push({
        method: res.request().method(),
        url: res.url().replace('https://app.headspamartina.hr', ''),
        status: res.status()
      });
    }
  });

  try {
    console.log('🔍 Testing device control buttons\n');

    await page.goto('https://app.headspamartina.hr/audio?v=' + Date.now(), {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    console.log('✅ Page loaded\n');

    // Find Play button
    const playButton = await page.$('button:has-text("Play")');
    if (playButton) {
      console.log('🎵 Found Play button, clicking...');
      await playButton.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('❌ Play button not found');
    }

    // Find Pause button
    const pauseButton = await page.$('button:has-text("Pause")');
    if (pauseButton) {
      console.log('⏸️  Found Pause button, clicking...');
      await pauseButton.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('⏸️  Pause button not found (might not be playing)');
    }

    // Find Stop button
    const stopButton = await page.$('button:has-text("Stop")');
    if (stopButton) {
      console.log('🛑 Found Stop button, clicking...');
      await stopButton.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('❌ Stop button not found');
    }

    console.log('\n📡 API Calls Made:');
    if (apiCalls.length === 0) {
      console.log('   ❌ No API calls detected');
    } else {
      apiCalls.forEach(call => {
        const icon = call.status >= 200 && call.status < 300 ? '✅' : '❌';
        console.log(`   ${icon} ${call.method} ${call.url} → ${call.status}`);
      });
    }

    await page.screenshot({ path: '/home/admin/fleet/device-controls-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved to device-controls-test.png');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testDeviceControls().catch(console.error);
