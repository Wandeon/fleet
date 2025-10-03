import { expect, test } from '@playwright/test';

test.describe('Zigbee Module Button Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/ui/api/zigbee/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/zigbee/overview')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hubStatus: 'online',
            devices: [
              { id: 'zb-1', name: 'Living Room Light', type: 'light', state: 'active', lastSeen: new Date().toISOString() }
            ],
            quickActions: [
              { id: 'all-on', label: 'All On' },
              { id: 'all-off', label: 'All Off' }
            ]
          }),
        });
      } else if (url.includes('/zigbee/pairing/start') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ expiresAt: new Date(Date.now() + 60000).toISOString() }),
        });
      } else if (url.includes('/zigbee/actions/') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hubStatus: 'online',
            devices: [],
            quickActions: []
          }),
        });
      }
    });

    await page.goto('/zigbee');
    await page.waitForLoadState('networkidle');
  });

  test('should start pairing and trigger API call', async ({ page }) => {
    const pairButton = page.getByRole('button', { name: 'Pair Device' });
    await expect(pairButton).toBeVisible();

    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ui/api/zigbee')) {
        apiCalls.push(request.url());
      }
    });

    await pairButton.click();
    await page.waitForTimeout(500);

    const pairingCall = apiCalls.find(url => url.includes('/zigbee/pairing/start'));
    expect(pairingCall).toBeTruthy();

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
  });

  test('should execute quick action and trigger API call', async ({ page }) => {
    const allOnButton = page.getByRole('button', { name: 'All On' });
    await expect(allOnButton).toBeVisible();

    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ui/api/zigbee')) {
        apiCalls.push(request.url());
      }
    });

    await allOnButton.click();
    await page.waitForTimeout(500);

    const actionCall = apiCalls.find(url => url.includes('/zigbee/actions/'));
    expect(actionCall).toBeTruthy();
  });
});
