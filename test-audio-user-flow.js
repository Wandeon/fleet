const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://app.headspamartina.hr';
const RESULTS_DIR = '/home/admin/fleet/flow-test-results';

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

const evidence = [];
let stepCounter = 0;

async function captureEvidence(page, stepName, description, apiCalls = []) {
  stepCounter++;
  const screenshotPath = `${RESULTS_DIR}/step-${String(stepCounter).padStart(2, '0')}-${stepName.replace(/[^a-z0-9]/gi, '_')}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });

  evidence.push({
    step: stepCounter,
    name: stepName,
    description,
    screenshot: screenshotPath,
    apiCalls: apiCalls,
    timestamp: new Date().toISOString()
  });

  console.log(`✅ Step ${stepCounter}: ${stepName}`);
  if (apiCalls.length > 0) {
    apiCalls.forEach(call => {
      console.log(`   📡 ${call.method} ${call.url} → ${call.status}`);
    });
  }
}

async function waitForAPI(page, urlPattern, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${urlPattern}`)), timeout);

    const responseHandler = async (response) => {
      if (response.url().includes(urlPattern)) {
        clearTimeout(timer);
        page.off('response', responseHandler);
        const status = response.status();
        let body = null;
        try {
          body = await response.text();
        } catch (e) {
          // Ignore
        }
        resolve({ url: response.url(), status, body });
      }
    };

    page.on('response', responseHandler);
  });
}

async function runUserFlow() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const networkLog = [];

  // Monitor all network traffic
  page.on('request', req => {
    if (req.url().includes('/api/') || req.url().includes('/ui/')) {
      networkLog.push({
        type: 'request',
        method: req.method(),
        url: req.url().replace(BASE_URL, ''),
        timestamp: Date.now()
      });
    }
  });

  page.on('response', async res => {
    if (res.url().includes('/api/') || res.url().includes('/ui/')) {
      const req = networkLog.find(r => r.type === 'request' && r.url === res.url().replace(BASE_URL, ''));
      if (req) {
        req.status = res.status();
        req.type = 'complete';
      }
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`   🔴 Console Error: ${msg.text()}`);
    }
  });

  try {
    console.log('\n🚀 AUDIO USER FLOW TEST - HARD EVIDENCE COLLECTION\n');

    // STEP 1: Navigate to Audio page
    await page.goto(`${BASE_URL}/audio`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const initialCalls = networkLog.filter(r => r.type === 'complete').map(r => ({
      method: r.method,
      url: r.url,
      status: r.status
    }));
    await captureEvidence(page, 'navigate-audio', 'Navigate to Audio page', initialCalls);

    // STEP 2: Click "Upload track" button
    console.log('\n📤 Testing Upload Track Flow...');
    const uploadBtn = await page.$('button:has-text("Upload track")');
    if (!uploadBtn) {
      throw new Error('Upload track button not found!');
    }

    await uploadBtn.click();
    await page.waitForTimeout(2000);

    // Check if modal opened (check for any modal, not just visible)
    let modal = await page.$('.modal');
    if (!modal) {
      console.log('   ❌ Upload modal did NOT open! Retrying...');
      await page.waitForTimeout(1000);
      await uploadBtn.click();
      await page.waitForTimeout(2000);
      modal = await page.$('.modal');
    }

    if (!modal) {
      console.log('   ❌ Modal still not appearing. Capturing evidence...');
      await captureEvidence(page, 'upload-modal-failed', 'Upload modal failed to open', []);
      console.log('   ⚠️  Skipping upload test, continuing to device controls...');
    } else {
      await captureEvidence(page, 'upload-modal-open', 'Upload track modal opened', []);

      // STEP 3: Fill upload form and submit
      console.log('\n📝 Filling upload form...');

      // Create a test audio file
      const testAudioPath = '/tmp/test-audio.mp3';
      if (!fs.existsSync(testAudioPath)) {
        // Create a minimal valid MP3 file (just header)
        const mp3Header = Buffer.from([
          0xFF, 0xFB, 0x90, 0x00, // MP3 frame header
          ...Array(1000).fill(0x00) // Some data
        ]);
        fs.writeFileSync(testAudioPath, mp3Header);
      }

      await page.setInputFiles('input[type="file"]', testAudioPath);
      await page.fill('input[placeholder*="title" i], input[name="title"]', 'Test Track Flow');
      await page.fill('input[placeholder*="artist" i], input[name="artist"]', 'Automation Test');
      await page.waitForTimeout(500);

      await captureEvidence(page, 'upload-form-filled', 'Upload form filled with test data', []);

      // STEP 4: Submit upload
      networkLog.length = 0; // Clear log
      const uploadSubmitBtn = await page.$('.modal button:has-text("Upload")');

      const uploadPromise = waitForAPI(page, '/audio/library', 10000);
      await uploadSubmitBtn.click();

      try {
        const uploadResult = await uploadPromise;
        await page.waitForTimeout(2000);

        const uploadCalls = networkLog.filter(r => r.type === 'complete').map(r => ({
          method: r.method,
          url: r.url,
          status: r.status
        }));

        await captureEvidence(page, 'upload-submitted', `Upload submitted - ${uploadResult.status}`, uploadCalls);

        // Check if modal closed
        const modalGone = await page.$('.modal:visible');
        if (modalGone) {
          console.log('   ⚠️  Modal still open after upload');
        }
      } catch (error) {
        console.log(`   ❌ Upload API call failed or timed out: ${error.message}`);
        await captureEvidence(page, 'upload-failed', 'Upload failed', []);
      }

      // STEP 5: Verify track appears in library
      console.log('\n🔍 Verifying track in library...');
      await page.waitForTimeout(1000);
      const trackInLibrary = await page.$('text="Test Track Flow"');
      if (trackInLibrary) {
        console.log('   ✅ Track found in library!');
      } else {
        console.log('   ❌ Track NOT found in library');
      }
      await captureEvidence(page, 'verify-library', 'Check if track appears in library', []);
    }

    // STEP 6: Select both devices
    console.log('\n🎯 Selecting devices...');
    const selectButtons = await page.$$('button:has-text("Select")');
    console.log(`   Found ${selectButtons.length} Select buttons`);

    if (selectButtons.length >= 2) {
      await selectButtons[0].click();
      await page.waitForTimeout(500);
      await selectButtons[1].click();
      await page.waitForTimeout(500);
      await captureEvidence(page, 'devices-selected', 'Both devices selected', []);
    } else {
      console.log('   ⚠️  Less than 2 devices available');
      await captureEvidence(page, 'devices-selected', `Only ${selectButtons.length} device(s) available`, []);
    }

    // STEP 7: Play track on selected devices
    console.log('\n▶️  Testing playback on selected devices...');
    const playOnSelectedBtn = await page.$('button:has-text("Play on selected")');

    if (playOnSelectedBtn) {
      networkLog.length = 0;
      const playPromise = waitForAPI(page, '/audio/', 5000);

      await playOnSelectedBtn.click();

      try {
        const playResult = await playPromise;
        await page.waitForTimeout(2000);

        const playCalls = networkLog.filter(r => r.type === 'complete').map(r => ({
          method: r.method,
          url: r.url,
          status: r.status
        }));

        await captureEvidence(page, 'play-on-selected', `Play on selected - ${playResult.status}`, playCalls);
      } catch (error) {
        console.log(`   ❌ Play API failed: ${error.message}`);
        await captureEvidence(page, 'play-failed', 'Play on selected failed', []);
      }
    } else {
      console.log('   ❌ "Play on selected" button not found');
      await captureEvidence(page, 'play-button-missing', 'Play on selected button not found', []);
    }

    // STEP 8: Test individual device controls
    console.log('\n🎮 Testing individual device controls...');

    // Find first device Play button
    const devicePlayBtns = await page.$$('button:has-text("Play")');
    if (devicePlayBtns.length > 0) {
      networkLog.length = 0;
      const devicePlayPromise = waitForAPI(page, '/resume', 5000);

      await devicePlayBtns[0].click();

      try {
        const result = await devicePlayPromise;
        await page.waitForTimeout(2000);

        const calls = networkLog.filter(r => r.type === 'complete').map(r => ({
          method: r.method,
          url: r.url,
          status: r.status
        }));

        await captureEvidence(page, 'device-play', `Device Play clicked - ${result.status}`, calls);
      } catch (error) {
        console.log(`   ❌ Device play failed: ${error.message}`);
      }
    }

    // STEP 9: Test Pause (if it exists)
    const pauseBtn = await page.$('button:has-text("Pause")');
    if (pauseBtn) {
      networkLog.length = 0;
      await pauseBtn.click();
      await page.waitForTimeout(2000);

      const pauseCalls = networkLog.filter(r => r.type === 'complete').map(r => ({
        method: r.method,
        url: r.url,
        status: r.status
      }));

      await captureEvidence(page, 'device-pause', 'Device Pause clicked', pauseCalls);
    } else {
      console.log('   ⚠️  Pause button not available');
    }

    // STEP 10: Test Stop
    const stopBtns = await page.$$('button:has-text("Stop")');
    if (stopBtns.length > 0) {
      networkLog.length = 0;
      const stopPromise = waitForAPI(page, '/stop', 5000);

      await stopBtns[0].click();

      try {
        const result = await stopPromise;
        await page.waitForTimeout(2000);

        const calls = networkLog.filter(r => r.type === 'complete').map(r => ({
          method: r.method,
          url: r.url,
          status: r.status
        }));

        await captureEvidence(page, 'device-stop', `Device Stop clicked - ${result.status}`, calls);
      } catch (error) {
        console.log(`   ❌ Stop failed: ${error.message}`);
      }
    }

    // STEP 11: Test Video page
    console.log('\n\n📺 Testing Video Controls...\n');
    await page.goto(`${BASE_URL}/video`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const videoCalls = networkLog.filter(r => r.type === 'complete').map(r => ({
      method: r.method,
      url: r.url,
      status: r.status
    }));
    await captureEvidence(page, 'navigate-video', 'Navigate to Video page', videoCalls);

    // Test Power button
    const powerBtn = await page.$('button:has-text("Power")');
    if (powerBtn) {
      networkLog.length = 0;
      const powerPromise = waitForAPI(page, '/video/', 5000);

      await powerBtn.click();

      try {
        const result = await powerPromise;
        await page.waitForTimeout(2000);

        const calls = networkLog.filter(r => r.type === 'complete').map(r => ({
          method: r.method,
          url: r.url,
          status: r.status
        }));

        await captureEvidence(page, 'video-power', `Video Power toggled - ${result.status}`, calls);
      } catch (error) {
        console.log(`   ❌ Video power failed: ${error.message}`);
      }
    }

    // Test input selection
    const inputBtns = await page.$$('button:has-text("HDMI")');
    if (inputBtns.length > 0) {
      networkLog.length = 0;
      await inputBtns[0].click();
      await page.waitForTimeout(2000);

      const calls = networkLog.filter(r => r.type === 'complete').map(r => ({
        method: r.method,
        url: r.url,
        status: r.status
      }));

      await captureEvidence(page, 'video-input', 'Video input selected', calls);
    }

    // Generate report
    console.log('\n\n📊 Generating Evidence Report...\n');

    const report = {
      testDate: new Date().toISOString(),
      baseUrl: BASE_URL,
      totalSteps: evidence.length,
      evidence: evidence
    };

    fs.writeFileSync(`${RESULTS_DIR}/flow-evidence.json`, JSON.stringify(report, null, 2));

    // Generate markdown report
    let md = `# Audio & Video User Flow Test - Hard Evidence\n\n`;
    md += `**Test Date:** ${report.testDate}\n`;
    md += `**Base URL:** ${BASE_URL}\n`;
    md += `**Total Steps:** ${evidence.length}\n\n`;
    md += `---\n\n`;

    evidence.forEach(ev => {
      md += `## Step ${ev.step}: ${ev.name}\n\n`;
      md += `**Description:** ${ev.description}\n\n`;

      if (ev.apiCalls.length > 0) {
        md += `**API Calls:**\n\n`;
        ev.apiCalls.forEach(call => {
          md += `- **${call.method}** \`${call.url}\` → Status: **${call.status}**\n`;
        });
        md += `\n`;
      } else {
        md += `*No API calls recorded*\n\n`;
      }

      md += `**Screenshot:** \`${path.basename(ev.screenshot)}\`\n\n`;
      md += `---\n\n`;
    });

    fs.writeFileSync(`${RESULTS_DIR}/flow-evidence.md`, md);

    console.log(`\n✅ Evidence collected in: ${RESULTS_DIR}`);
    console.log(`   - flow-evidence.json (full data)`);
    console.log(`   - flow-evidence.md (readable report)`);
    console.log(`   - ${evidence.length} screenshots\n`);

    // Print summary
    console.log('📋 SUMMARY:\n');
    evidence.forEach(ev => {
      const apiStatus = ev.apiCalls.length > 0
        ? ev.apiCalls.map(c => `${c.status}`).join(', ')
        : 'No API';
      console.log(`   ${ev.step}. ${ev.name} - ${apiStatus}`);
    });

  } catch (error) {
    console.error('\n💥 Fatal Error:', error.message);
    await page.screenshot({ path: `${RESULTS_DIR}/error-state.png`, fullPage: true });
  } finally {
    await browser.close();
  }
}

runUserFlow().catch(console.error);
