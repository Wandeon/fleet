import { test, expect } from '@playwright/test';

const uiBase = process.env.UI_BASE_URL || 'http://localhost:4173';
const expectedTitle = process.env.UI_EXPECTED_TITLE || 'Head Spa Control';

const mockHealth = () => ({
  overall: 'UP',
  components: { 'pi-audio-01': 'UP' },
  devices: [
    {
      id: 'pi-audio-01',
      name: 'Head Spa Player',
      kind: 'audio',
      status: 'UP',
      updatedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    },
  ],
  timestamp: new Date().toISOString(),
});

const mockDevices = () => ({
  devices: [
    {
      id: 'pi-audio-01',
      name: 'Head Spa Player',
      kind: 'audio',
      capabilities: {
        operations: ['play', 'stop'],
        endpoints: ['status'],
        management: { summary: 'Audio player Pi' },
      },
    },
  ],
});

const mockDeviceStates = () => ({
  states: [
    {
      deviceId: 'pi-audio-01',
      status: 'online',
      updatedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    },
  ],
});

test.describe('Fleet UI acceptance', () => {
  test('dashboard loads with mocked API responses', async ({ page }) => {
    await page.route('**/api/health', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockHealth()),
      })
    );
    await page.route('**/api/healthz', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockHealth()),
      })
    );
    await page.route('**/api/devices', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockDevices()),
      })
    );
    await page.route('**/api/device_states', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockDeviceStates()),
      })
    );
    await page.route('**/api/stream**', (route) =>
      route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: '' })
    );

    await page.goto(uiBase, { waitUntil: 'networkidle' });

    await expect(page.locator('body')).toContainText(expectedTitle);
    await expect(page.locator('h1')).toContainText('Operations overview');
    await expect(page.locator('body')).toContainText('Head Spa Player');
  });
});
