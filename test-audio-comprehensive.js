/**
 * Comprehensive Audio Tab Verification
 * Tests every interactive control on the Audio page
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://app.headspamartina.hr';
const RESULTS_DIR = '/home/admin/fleet/audio-test-results';
const TIMEOUT = 10000;

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

const results = [];
let browser, context, page;

async function setup() {
  console.log('🚀 Launching browser...');
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
  });

  page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[CONSOLE ${type.toUpperCase()}]`, msg.text());
    }
  });

  console.log('✅ Browser ready');
}

async function navigateToAudio() {
  console.log('🔗 Navigating to Audio page...');
  const requests = [];

  // Monitor network traffic
  page.on('request', req => {
    if (req.url().includes('/api/') || req.url().includes('/ui/')) {
      requests.push({
        method: req.method(),
        url: req.url(),
        postData: req.postData()
      });
    }
  });

  await page.goto(`${BASE_URL}/audio`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000); // Let the page fully load

  console.log(`✅ Loaded Audio page - ${requests.length} API requests made`);
  return requests;
}

async function captureScreenshot(name) {
  const filename = `${RESULTS_DIR}/${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
  await page.screenshot({ path: filename, fullPage: false });
  return filename;
}

async function testButton(selector, label, description) {
  console.log(`\n🔍 Testing: ${label}`);
  const testResult = {
    control_type: 'button',
    label: label,
    selector: selector,
    description: description,
    click_registered: false,
    api_requests: [],
    console_errors: [],
    ui_changes: '',
    screenshot_before: '',
    screenshot_after: '',
    status: 'NOT_TESTED',
    notes: ''
  };

  try {
    // Check if element exists
    const element = await page.$(selector);
    if (!element) {
      testResult.status = 'NOT_FOUND';
      testResult.notes = 'Element not found in DOM';
      results.push(testResult);
      return;
    }

    // Check if element is visible
    const isVisible = await element.isVisible();
    if (!isVisible) {
      testResult.status = 'NOT_VISIBLE';
      testResult.notes = 'Element exists but not visible';
      results.push(testResult);
      return;
    }

    // Check if disabled
    const isDisabled = await element.isDisabled();
    if (isDisabled) {
      testResult.status = 'DISABLED';
      testResult.notes = 'Button is disabled';
      results.push(testResult);
      return;
    }

    // Screenshot before
    testResult.screenshot_before = await captureScreenshot(`${label}_before`);

    // Monitor network and console
    const networkRequests = [];
    const consoleErrors = [];

    const requestListener = req => {
      if (req.url().includes('/api/') || req.url().includes('/ui/')) {
        networkRequests.push({
          method: req.method(),
          url: req.url().replace(BASE_URL, ''),
          postData: req.postData() || 'none'
        });
      }
    };

    const responseListener = async res => {
      if (res.url().includes('/api/') || res.url().includes('/ui/')) {
        try {
          const status = res.status();
          const body = await res.text().catch(() => 'unable to read');
          const request = networkRequests.find(r => r.url === res.url().replace(BASE_URL, ''));
          if (request) {
            request.status = status;
            request.response = body.length > 200 ? body.substring(0, 200) + '...' : body;
          }
        } catch (e) {
          // Ignore response parsing errors
        }
      }
    };

    const consoleListener = msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    };

    page.on('request', requestListener);
    page.on('response', responseListener);
    page.on('console', consoleListener);

    // Click the button
    await element.click();
    testResult.click_registered = true;

    // Wait for potential network activity
    await page.waitForTimeout(2000);

    // Remove listeners
    page.off('request', requestListener);
    page.off('response', responseListener);
    page.off('console', consoleListener);

    // Screenshot after
    testResult.screenshot_after = await captureScreenshot(`${label}_after`);

    // Record results
    testResult.api_requests = networkRequests;
    testResult.console_errors = consoleErrors;

    // Check for toasts or UI changes
    const toasts = await page.$$('.toast, [role="alert"], .banner');
    if (toasts.length > 0) {
      const toastTexts = await Promise.all(toasts.map(t => t.textContent()));
      testResult.ui_changes = toastTexts.join('; ');
    }

    // Determine status
    if (networkRequests.length > 0) {
      const hasSuccessful = networkRequests.some(r => r.status >= 200 && r.status < 300);
      const hasErrors = networkRequests.some(r => r.status >= 400);

      if (hasSuccessful) {
        testResult.status = 'PASS';
      } else if (hasErrors) {
        testResult.status = 'FAIL';
        testResult.notes = 'API requests returned errors';
      } else {
        testResult.status = 'PENDING';
        testResult.notes = 'Requests made but no response captured';
      }
    } else if (testResult.ui_changes) {
      testResult.status = 'PASS';
      testResult.notes = 'UI feedback provided (toast/banner)';
    } else {
      testResult.status = 'NO_OP';
      testResult.notes = 'Click registered but no observable effect';
    }

    if (consoleErrors.length > 0) {
      testResult.status = 'FAIL';
      testResult.notes += ' | Console errors detected';
    }

  } catch (error) {
    testResult.status = 'ERROR';
    testResult.notes = error.message;
    console.error(`❌ Error testing ${label}:`, error.message);
  }

  results.push(testResult);
  console.log(`   Status: ${testResult.status}`);
  if (testResult.api_requests.length > 0) {
    console.log(`   API Calls: ${testResult.api_requests.length}`);
  }
}

async function testInput(selector, label, testValue, description) {
  console.log(`\n🔍 Testing Input: ${label}`);
  const testResult = {
    control_type: 'input',
    label: label,
    selector: selector,
    description: description,
    interaction_type: 'fill',
    test_value: testValue,
    api_requests: [],
    console_errors: [],
    ui_changes: '',
    status: 'NOT_TESTED',
    notes: ''
  };

  try {
    const element = await page.$(selector);
    if (!element) {
      testResult.status = 'NOT_FOUND';
      results.push(testResult);
      return;
    }

    // Monitor network
    const networkRequests = [];
    const requestListener = req => {
      if (req.url().includes('/api/') || req.url().includes('/ui/')) {
        networkRequests.push({
          method: req.method(),
          url: req.url().replace(BASE_URL, '')
        });
      }
    };

    page.on('request', requestListener);

    await element.fill(testValue);
    await page.waitForTimeout(1000);

    page.off('request', requestListener);

    testResult.api_requests = networkRequests;
    testResult.status = networkRequests.length > 0 ? 'PASS' : 'NO_OP';

  } catch (error) {
    testResult.status = 'ERROR';
    testResult.notes = error.message;
  }

  results.push(testResult);
}

async function testSlider(selector, label, description) {
  console.log(`\n🔍 Testing Slider: ${label}`);
  const testResult = {
    control_type: 'slider',
    label: label,
    selector: selector,
    description: description,
    interaction_type: 'slide',
    api_requests: [],
    console_errors: [],
    status: 'NOT_TESTED',
    notes: ''
  };

  try {
    const element = await page.$(selector);
    if (!element) {
      testResult.status = 'NOT_FOUND';
      results.push(testResult);
      return;
    }

    const networkRequests = [];
    page.on('request', req => {
      if (req.url().includes('/api/')) {
        networkRequests.push({
          method: req.method(),
          url: req.url().replace(BASE_URL, '')
        });
      }
    });

    // Try to change slider value
    await element.fill('50');
    await page.waitForTimeout(1500);

    testResult.api_requests = networkRequests;
    testResult.status = networkRequests.length > 0 ? 'PASS' : 'NO_OP';

  } catch (error) {
    testResult.status = 'ERROR';
    testResult.notes = error.message;
  }

  results.push(testResult);
}

async function runTests() {
  try {
    await setup();
    await navigateToAudio();

    console.log('\n📋 Starting comprehensive Audio tab testing...\n');

    // Test device control buttons (if any devices exist)
    const deviceCards = await page.$$('[class*="device"]');
    console.log(`Found ${deviceCards.length} potential device elements`);

    // Test common Audio page buttons
    await testButton('button:has-text("Upload track")', 'Upload Track Button', 'Opens modal to upload audio file to library');
    await testButton('button:has-text("New playlist")', 'New Playlist Button', 'Opens modal to create new playlist');
    await testButton('button:has-text("Open audio control")', 'Open Audio Control Button', 'Navigate to audio control page');
    await testButton('button:has-text("Refresh")', 'Refresh Button', 'Reload audio data from API');
    await testButton('button:has-text("Start playback")', 'Start Playback Button', 'Begin playback on selected devices');
    await testButton('button:has-text("Clear selection")', 'Clear Selection Button', 'Clear device selection');

    // Test device-specific controls (look for first device)
    await testButton('button:has-text("Select") >> nth=0', 'Device Select Button', 'Select device for operations');
    await testButton('button:has-text("Play") >> nth=0', 'Device Play Button', 'Play audio on device');
    await testButton('button:has-text("Pause") >> nth=0', 'Device Pause Button', 'Pause playback on device');
    await testButton('button:has-text("Stop") >> nth=0', 'Device Stop Button', 'Stop playback on device');
    await testButton('button:has-text("Replace fallback") >> nth=0', 'Replace Fallback Button', 'Upload fallback audio for device');
    await testButton('button:has-text("Upload fallback") >> nth=0', 'Upload Fallback Button', 'Upload fallback audio file');
    await testButton('button:has-text("Re-sync") >> nth=0', 'Re-sync Button', 'Re-sync device playback');

    // Test library actions
    await testButton('button:has-text("Play on selected") >> nth=0', 'Library Play on Selected', 'Play track on selected devices');

    // Test playlist actions
    await testButton('button:has-text("Edit") >> nth=0', 'Edit Playlist Button', 'Edit playlist details');
    await testButton('button:has-text("Delete") >> nth=0', 'Delete Playlist Button', 'Delete playlist');

    // Test sliders
    await testSlider('input[type="range"] >> nth=0', 'Master Volume Slider', 'Adjust master volume');
    await testSlider('input[type="range"] >> nth=1', 'Device Volume Slider', 'Adjust device volume');

    // Test mode toggles
    await testButton('button:has-text("Single track")', 'Single Track Mode', 'Select single track playback mode');
    await testButton('button:has-text("Per device")', 'Per Device Mode', 'Select per-device playback mode');
    await testButton('button:has-text("Playlist")', 'Playlist Mode', 'Select playlist playback mode');

    console.log('\n✅ Testing complete!');

  } catch (error) {
    console.error('❌ Fatal error during testing:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function generateReport() {
  console.log('\n📊 Generating reports...');

  // Generate CSV
  const csvHeaders = 'Control Type,Label,Selector,Description,Click Registered,API Requests Count,API Details,Response Status,UI Changes,Console Errors,Status,Notes\n';
  const csvRows = results.map(r => {
    const apiRequests = r.api_requests || [];
    const consoleErrors = r.console_errors || [];
    const apiDetails = apiRequests.map(req =>
      `${req.method} ${req.url} (${req.status || 'pending'})`
    ).join(' | ');

    return [
      r.control_type,
      `"${r.label}"`,
      `"${r.selector}"`,
      `"${r.description || ''}"`,
      r.click_registered || 'N/A',
      apiRequests.length,
      `"${apiDetails}"`,
      apiRequests[0]?.status || 'N/A',
      `"${r.ui_changes || 'none'}"`,
      consoleErrors.length > 0 ? 'YES' : 'NO',
      r.status,
      `"${r.notes || ''}"`
    ].join(',');
  });

  const csvContent = csvHeaders + csvRows.join('\n');
  fs.writeFileSync(`${RESULTS_DIR}/audio-test-report.csv`, csvContent);

  // Generate detailed Markdown report
  let mdReport = `# Audio Tab Comprehensive Test Report\n\n`;
  mdReport += `**Test Date:** ${new Date().toISOString()}\n`;
  mdReport += `**Base URL:** ${BASE_URL}\n`;
  mdReport += `**Total Controls Tested:** ${results.length}\n\n`;

  // Summary statistics
  const summary = {
    PASS: results.filter(r => r.status === 'PASS').length,
    FAIL: results.filter(r => r.status === 'FAIL').length,
    NO_OP: results.filter(r => r.status === 'NO_OP').length,
    NOT_FOUND: results.filter(r => r.status === 'NOT_FOUND').length,
    DISABLED: results.filter(r => r.status === 'DISABLED').length,
    ERROR: results.filter(r => r.status === 'ERROR').length
  };

  mdReport += `## Summary\n\n`;
  mdReport += `- ✅ PASS: ${summary.PASS}\n`;
  mdReport += `- ❌ FAIL: ${summary.FAIL}\n`;
  mdReport += `- ⚠️ NO_OP (no observable effect): ${summary.NO_OP}\n`;
  mdReport += `- 🔍 NOT_FOUND: ${summary.NOT_FOUND}\n`;
  mdReport += `- 🚫 DISABLED: ${summary.DISABLED}\n`;
  mdReport += `- 💥 ERROR: ${summary.ERROR}\n\n`;

  mdReport += `## Detailed Results\n\n`;
  mdReport += `| Control | Type | Click | API Requests | Response | UI Changes | Status | Notes |\n`;
  mdReport += `|---------|------|-------|--------------|----------|------------|--------|-------|\n`;

  results.forEach(r => {
    const apiRequests = r.api_requests || [];
    const apiSummary = apiRequests.length > 0
      ? `${apiRequests.length} (${apiRequests.map(req => `${req.method} ${req.url.split('/').pop()}`).join(', ')})`
      : 'none';

    const statusIcon = {
      'PASS': '✅',
      'FAIL': '❌',
      'NO_OP': '⚠️',
      'NOT_FOUND': '🔍',
      'DISABLED': '🚫',
      'ERROR': '💥',
      'NOT_TESTED': '❓'
    }[r.status] || '❓';

    mdReport += `| ${r.label} | ${r.control_type} | ${r.click_registered ? 'YES' : 'NO'} | ${apiSummary} | ${apiRequests[0]?.status || 'N/A'} | ${r.ui_changes || 'none'} | ${statusIcon} ${r.status} | ${r.notes || ''} |\n`;
  });

  mdReport += `\n## Detailed API Call Log\n\n`;
  results.forEach(r => {
    const apiRequests = r.api_requests || [];
    if (apiRequests.length > 0) {
      mdReport += `### ${r.label}\n\n`;
      apiRequests.forEach(req => {
        mdReport += `- **${req.method}** \`${req.url}\`\n`;
        mdReport += `  - Status: ${req.status || 'pending'}\n`;
        if (req.postData) {
          mdReport += `  - Payload: \`${req.postData}\`\n`;
        }
        if (req.response) {
          mdReport += `  - Response: \`${req.response}\`\n`;
        }
        mdReport += `\n`;
      });
    }
  });

  fs.writeFileSync(`${RESULTS_DIR}/audio-test-report.md`, mdReport);

  // Generate JSON for programmatic access
  fs.writeFileSync(`${RESULTS_DIR}/audio-test-results.json`, JSON.stringify(results, null, 2));

  console.log(`✅ Reports generated:`);
  console.log(`   - ${RESULTS_DIR}/audio-test-report.csv`);
  console.log(`   - ${RESULTS_DIR}/audio-test-report.md`);
  console.log(`   - ${RESULTS_DIR}/audio-test-results.json`);
  console.log(`   - Screenshots: ${RESULTS_DIR}/*.png`);
}

// Run the tests
runTests().then(() => {
  generateReport();
  console.log('\n🎉 Audio tab verification complete!\n');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
