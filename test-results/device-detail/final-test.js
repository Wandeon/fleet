const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://app.headspamartina.hr';
const RESULTS_DIR = '/home/admin/fleet/test-results/device-detail';

// We'll discover device IDs from the fleet page first
async function discoverDevices(page) {
  console.log('Discovering devices from fleet page...');
  await page.goto(`${BASE_URL}/fleet`, { waitUntil: 'networkidle' });

  // Get device count
  const deviceCount = await page.$$eval('button.device-card', cards => cards.length);
  console.log(`Found ${deviceCount} device cards`);

  const devices = [];

  for (let i = 0; i < Math.min(deviceCount, 4); i++) {
    // Re-query to avoid stale elements
    const cards = await page.$$('button.device-card');
    const card = cards[i];

    const info = await card.evaluate(el => {
      const h3 = el.querySelector('h3');
      const dds = el.querySelectorAll('dd');
      return {
        name: h3?.textContent?.trim(),
        type: dds[0]?.textContent?.trim(),
        location: dds[1]?.textContent?.trim()
      };
    });

    // Set up request listener
    let capturedDeviceId = null;
    const requestHandler = req => {
      const match = req.url().match(/\/fleet\/([\w-]+)$/);
      if (match) {
        capturedDeviceId = match[1];
      }
    };
    page.on('request', requestHandler);

    // Click and wait for navigation
    await Promise.all([
      card.click(),
      page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    ]);

    await page.waitForTimeout(1000);

    // Check URL for device ID
    const urlMatch = page.url().match(/\/fleet\/([\w-]+)$/);
    const deviceId = urlMatch ? urlMatch[1] : capturedDeviceId;

    page.off('request', requestHandler);

    if (deviceId && info.name) {
      devices.push({ id: deviceId, ...info });
      console.log(`  - ${info.name} (${deviceId}): ${info.type}`);
    }

    // Go back
    await page.goBack({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
  }

  return devices;
}

async function testDeviceDetail(page, device) {
  console.log(`\n=== Testing ${device.name} (${device.id}) ===`);

  const result = {
    device: device.name,
    deviceId: device.id,
    type: device.type,
    buttons: [],
    tabs: [],
    error: null
  };

  try {
    // Navigate
    await page.goto(`${BASE_URL}/fleet/${device.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Screenshot
    const screenshotName = `${device.type || 'device'}-${device.id}`;
    await page.screenshot({
      path: path.join(RESULTS_DIR, `screenshots/${screenshotName}.png`),
      fullPage: true
    });

    // Check for error
    const errorEl = await page.$('text=Something went wrong');
    if (errorEl) {
      result.error = 'Page shows error message';
      console.log(`❌ Error loading page`);
      return result;
    }

    // Find all buttons
    const allButtons = await page.$$eval('button, [role="button"], input[type="button"]', elements => {
      return elements.map((el, idx) => {
        const rect = el.getBoundingClientRect();
        return {
          index: idx,
          tag: el.tagName,
          text: (el.textContent || el.value || el.getAttribute('aria-label') || '').trim(),
          disabled: el.disabled || el.hasAttribute('disabled'),
          visible: rect.width > 0 && rect.height > 0,
          className: el.className
        };
      }).filter(b => b.visible && b.text);
    });

    console.log(`Found ${allButtons.length} interactive buttons`);

    // Test each button
    for (const btnInfo of allButtons) {
      console.log(`  Testing: "${btnInfo.text}"`);

      const btnResult = {
        label: btnInfo.text,
        enabled: !btnInfo.disabled,
        result: 'UNKNOWN',
        evidence: []
      };

      if (btnInfo.disabled) {
        btnResult.result = 'SKIP';
        btnResult.evidence.push('Disabled');
        result.buttons.push(btnResult);
        continue;
      }

      // Try to click
      try {
        const buttons = await page.$$('button');
        let clicked = false;

        for (const btn of buttons) {
          const text = await btn.textContent();
          if (text?.trim() === btnInfo.text) {
            // Track network activity
            const requestsBefore = [];
            const requestHandler = req => requestsBefore.push(req.url());
            page.on('request', requestHandler);

            await btn.click();
            await page.waitForTimeout(1500);

            page.off('request', requestHandler);

            // Check for network activity
            if (requestsBefore.length > 0) {
              btnResult.result = 'PASS';
              btnResult.evidence.push(`Triggered ${requestsBefore.length} request(s)`);
            } else {
              btnResult.result = 'STUB';
              btnResult.evidence.push('No network activity');
            }

            clicked = true;
            break;
          }
        }

        if (!clicked) {
          btnResult.result = 'FAIL';
          btnResult.evidence.push('Could not click button');
        }
      } catch (err) {
        btnResult.result = 'FAIL';
        btnResult.evidence.push(`Error: ${err.message}`);
      }

      result.buttons.push(btnResult);
    }

    console.log(`Results: ${result.buttons.filter(b => b.result === 'PASS').length} PASS, ${result.buttons.filter(b => b.result === 'FAIL').length} FAIL, ${result.buttons.filter(b => b.result === 'STUB').length} STUB`);

  } catch (err) {
    result.error = err.message;
    console.error(`Error testing device: ${err.message}`);
  }

  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    // Discover devices
    const devices = await discoverDevices(page);

    if (devices.length === 0) {
      console.error('No devices discovered!');
      await browser.close();
      return;
    }

    // Find audio and video devices
    const audioDevice = devices.find(d => d.type?.toLowerCase().includes('audio'));
    const videoDevice = devices.find(d => d.type?.toLowerCase().includes('video'));

    const devicesToTest = [];
    if (audioDevice) devicesToTest.push(audioDevice);
    if (videoDevice) devicesToTest.push(videoDevice);

    // Fallback to first 2 devices
    if (devicesToTest.length < 2) {
      devicesToTest.push(...devices.slice(0, 2).filter(d => !devicesToTest.includes(d)));
    }

    console.log(`\nTesting ${devicesToTest.length} devices...`);

    // Test each device
    const allResults = [];
    for (const device of devicesToTest) {
      const result = await testDeviceDetail(page, device);
      allResults.push(result);
    }

    // Generate reports
    const summary = {
      total: allResults.reduce((sum, r) => sum + r.buttons.length, 0),
      pass: allResults.reduce((sum, r) => sum + r.buttons.filter(b => b.result === 'PASS').length, 0),
      fail: allResults.reduce((sum, r) => sum + r.buttons.filter(b => b.result === 'FAIL').length, 0),
      stub: allResults.reduce((sum, r) => sum + r.buttons.filter(b => b.result === 'STUB').length, 0)
    };

    // Save results
    fs.writeFileSync(
      path.join(RESULTS_DIR, 'results.json'),
      JSON.stringify({ devices: allResults, summary }, null, 2)
    );

    // Generate CSV
    const csvLines = ['Device,DeviceID,Type,Button,Enabled,Result,Evidence'];
    for (const dev of allResults) {
      for (const btn of dev.buttons) {
        csvLines.push([
          `"${dev.device}"`,
          dev.deviceId,
          dev.type || '',
          `"${btn.label}"`,
          btn.enabled,
          btn.result,
          `"${btn.evidence.join('; ')}"`
        ].join(','));
      }
    }
    fs.writeFileSync(path.join(RESULTS_DIR, 'buttons.csv'), csvLines.join('\n'));

    // Generate report
    const report = `# Device Detail Page Test Report

## Summary
- **Devices Tested:** ${allResults.length}
- **Total Buttons:** ${summary.total}
- **PASS:** ${summary.pass}
- **FAIL:** ${summary.fail}
- **STUB:** ${summary.stub}

## Devices Tested

${allResults.map(r => `### ${r.device} (${r.deviceId})
- **Type:** ${r.type}
- **Buttons Found:** ${r.buttons.length}
- **Error:** ${r.error || 'None'}

**Button Results:**
${r.buttons.map(b => `- **${b.label}**: ${b.result} - ${b.evidence.join(', ')}`).join('\n')}
`).join('\n')}

## Artifacts
- \`results.json\` - Full test results
- \`buttons.csv\` - CSV export of button tests
- \`screenshots/\` - Device detail page screenshots

---
**Test completed:** ${new Date().toISOString()}
`;

    fs.writeFileSync(path.join(RESULTS_DIR, 'report.md'), report);

    console.log(`\n=== FINAL SUMMARY ===`);
    console.log(`Devices: ${allResults.length}`);
    console.log(`Buttons: ${summary.total}`);
    console.log(`PASS: ${summary.pass}`);
    console.log(`FAIL: ${summary.fail}`);
    console.log(`STUB: ${summary.stub}`);
    console.log(`\nReports saved to: ${RESULTS_DIR}`);

  } catch (err) {
    console.error('Test failed:', err);
    fs.writeFileSync(path.join(RESULTS_DIR, 'error.log'), err.stack);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
