import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://app.headspamartina.hr';
const AUDIO_PAGE_URL = `${BASE_URL}/audio`;

// Results tracking
const results = {
  summary: {
    totalButtons: 0,
    pass: 0,
    fail: 0,
    stub: 0,
  },
  buttons: [],
  devices: [],
  timestamp: new Date().toISOString(),
};

function addButtonResult(deviceId, control, label, status, evidence) {
  results.summary.totalButtons++;
  results.summary[status.toLowerCase()]++;

  results.buttons.push({
    deviceId,
    control,
    label,
    status,
    evidence,
    timestamp: new Date().toISOString(),
  });
}

test.describe('Audio Controls Black-Box Testing', () => {
  let screenshotDir;
  let consoleMessages = [];
  let networkRequests = [];

  test.beforeAll(async () => {
    const testDir = path.resolve('./audio-test');
    screenshotDir = path.join(testDir, 'screenshots');
    const artifactsDir = path.join(testDir, 'artifacts');
    fs.mkdirSync(screenshotDir, { recursive: true });
    fs.mkdirSync(artifactsDir, { recursive: true });
  });

  test.beforeEach(async ({ page, context }) => {
    consoleMessages = [];
    networkRequests = [];

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
      });
    });

    page.on('request', (request) => {
      networkRequests.push({
        method: request.method(),
        url: request.url(),
        timestamp: new Date().toISOString(),
      });
    });

    page.on('response', async (response) => {
      const request = response.request();
      const matchingRequest = networkRequests.find(r => r.url === request.url());
      if (matchingRequest) {
        matchingRequest.status = response.status();
      }
    });

    await context.tracing.start({ screenshots: true, snapshots: true });
  });

  test.afterEach(async ({ context }, testInfo) => {
    const tracePath = path.join('./audio-test/artifacts', `trace-${testInfo.title.replace(/\s+/g, '-')}.zip`);
    await context.tracing.stop({ path: tracePath });
  });

  test('01 - Initial page load and device enumeration', async ({ page }) => {
    await page.goto(AUDIO_PAGE_URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(screenshotDir, '01-initial-load.png'), fullPage: true });

    const deviceRows = await page.locator('[data-device-id], .device-row, .audio-device').all();
    console.log(`Found ${deviceRows.length} device rows`);

    for (let i = 0; i < deviceRows.length; i++) {
      const row = deviceRows[i];
      const deviceId = await row.getAttribute('data-device-id') || `device-${i}`;
      const deviceName = await row.locator('.device-name, [data-device-name]').textContent().catch(() => 'Unknown');
      results.devices.push({ id: deviceId, name: deviceName.trim(), index: i });
    }

    fs.writeFileSync(path.join('./audio-test/artifacts', 'devices.json'), JSON.stringify(results.devices, null, 2));
  });

  test('02 - Play button functionality', async ({ page }) => {
    await page.goto(AUDIO_PAGE_URL, { waitUntil: 'networkidle' });
    const playButtons = await page.locator('button:has-text("Play"), button[aria-label*="Play"]').all();

    for (let i = 0; i < playButtons.length; i++) {
      const button = playButtons[i];
      const deviceRow = await button.locator('xpath=ancestor::*[@data-device-id or contains(@class, "device-row")]').first();
      const deviceId = await deviceRow.getAttribute('data-device-id').catch(() => `device-${i}`);

      networkRequests = [];
      await button.click();
      await page.waitForTimeout(1000);

      const playRequest = networkRequests.find(r => r.method === 'POST' && r.url.includes('/audio/') && r.url.includes('/play'));
      const status = (playRequest && playRequest.status >= 200 && playRequest.status < 300) ? 'PASS' : 'FAIL';
      addButtonResult(deviceId, 'play', 'Play', status, JSON.stringify({ hasRequest: !!playRequest, status: playRequest?.status }));
    }
  });

  test.afterAll(async () => {
    const reportPath = path.join('./audio-test', 'report.md');
    const csvPath = path.join('./audio-test', 'buttons.csv');

    const csvLines = [
      'Device ID,Control,Label,Status,Evidence',
      ...results.buttons.map(b => `"${b.deviceId}","${b.control}","${b.label}","${b.status}","${b.evidence}"`)
    ];
    fs.writeFileSync(csvPath, csvLines.join('\n'));

    const report = `# Audio Controls Test Report\n\n## Summary\n\nTotal Buttons: ${results.summary.totalButtons}\nPASS: ${results.summary.pass}\nFAIL: ${results.summary.fail}\nSTUB: ${results.summary.stub}\n\n## Exit Summary\n\nAudio: ${results.summary.totalButtons} buttons tested — ${results.summary.pass} PASS / ${results.summary.fail} FAIL / ${results.summary.stub} STUB.\n`;
    fs.writeFileSync(reportPath, report);
  });
});
