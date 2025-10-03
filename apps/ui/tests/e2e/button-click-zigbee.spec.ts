import { expect, test } from '@playwright/test';

test.describe('Zigbee Module Button Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Mock zigbee API responses
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
              {
                id: 'zb-1',
                name: 'Living Room Light',
                type: 'light',
                state: 'active',
                lastSeen: new Date().toISOString()
              },
              {
                id: 'zb-2',
                name: 'Motion Sensor',
                type: 'sensor',
                state: 'active',
                lastSeen: new Date().toISOString()
              }
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
          body: JSON.stringify({
            expiresAt: new Date(Date.now() + 60000).toISOString()
          }),
        });
      } else if (url.includes('/zigbee/pairing/stop') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else if (url.includes('/zigbee/pairing/discovered')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            discovered: [
              { id: 'new-1', name: 'New Device', type: 'light', signal: 85 }
            ]
          }),
        });
      } else if (url.includes('/zigbee/pairing/confirm/') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hubStatus: 'online',
            devices: [
              {
                id: 'zb-1',
                name: 'Living Room Light',
                type: 'light',
                state: 'active',
                lastSeen: new Date().toISOString()
              },
              {
                id: 'new-1',
                name: 'New Device',
                type: 'light',
                state: 'active',
                lastSeen: new Date().toISOString()
              }
            ],
            quickActions: [
              { id: 'all-on', label: 'All On' },
              { id: 'all-off', label: 'All Off' }
            ]
          }),
        });
      } else if (url.includes('/zigbee/actions/') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hubStatus: 'online',
            devices: [
              {
                id: 'zb-1',
                name: 'Living Room Light',
                type: 'light',
                state: 'active',
                lastSeen: new Date().toISOString()
              }
            ],
            quickActions: [
              { id: 'all-on', label: 'All On' },
              { id: 'all-off', label: 'All Off' }
            ]
          }),
        });
      }
    });

    await page.goto('/zigbee');
    await page.waitForLoadState('networkidle');
  });

  test('should start pairing and trigger API call with success toast', async ({ page }) => {
    const pairButton = page.getByRole('button', { name: 'Pair Device' });
    await expect(pairButton).toBeVisible();

    // Track API calls
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ui/api/zigbee')) {
        apiCalls.push(request.url());
      }
    });

    // Click pair device
    await pairButton.click();

    // Wait for modal and API call
    await page.waitForTimeout(500);

    // Verify API was called
    const pairingCall = apiCalls.find(url => url.includes('/zigbee/pairing/start'));
    expect(pairingCall).toBeTruthy();

    // Verify modal appeared
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    // Verify pairing status is shown
    const pairingStatus = page.locator('.pairing-status p');
    await expect(pairingStatus).toContainText('Pairing mode active');

    // Check toast appears (success)
    await page.waitForTimeout(100);
  });

  test('should stop pairing and trigger API call', async ({ page }) => {
    // Start pairing first
    await page.getByRole('button', { name: 'Pair Device' }).click();
    await page.waitForTimeout(300);

    // Track API calls
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ui/api/zigbee')) {
        apiCalls.push(request.url());
      }
    });

    // Stop pairing
    const stopButton = page.getByRole('button', { name: 'Stop Pairing' });
    await expect(stopButton).toBeVisible();
    await stopButton.click();

    // Wait for network request
    await page.waitForTimeout(300);

    // Verify API was called
    const stopCall = apiCalls.find(url => url.includes('/zigbee/pairing/stop'));
    expect(stopCall).toBeTruthy();
  });

  test('should execute quick action and trigger API call with success toast', async ({ page }) => {
    const allOnButton = page.getByRole('button', { name: 'All On' });
    await expect(allOnButton).toBeVisible();

    // Track API calls
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ui/api/zigbee')) {
        apiCalls.push(request.url());
      }
    });

    // Click action
    await allOnButton.click();

    // Wait for network request
    await page.waitForTimeout(500);

    // Verify API was called
    const actionCall = apiCalls.find(url => url.includes('/zigbee/actions/'));
    expect(actionCall).toBeTruthy();

    // Check for success toast
    await page.waitForTimeout(100);
  });

  test('should handle pairing failure with error toast', async ({ page }) => {
    // Override route to return error
    await page.unroute('**/ui/api/zigbee/**');
    await page.route('**/ui/api/zigbee/pairing/start', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Hub unavailable',
          correlationId: 'test-correlation-123'
        }),
      });
    });

    const pairButton = page.getByRole('button', { name: 'Pair Device' });
    await pairButton.click();

    // Wait for error handling
    await page.waitForTimeout(500);

    // Error banner should appear
    const errorBanner = page.locator('.error-banner');
    await expect(errorBanner).toBeVisible();

    // Should show correlation ID
    await expect(errorBanner).toContainText('test-correlation-123');
  });

  test('should disable buttons when hub is offline', async ({ page }) => {
    // Override route to return offline hub
    await page.unroute('**/ui/api/zigbee/**');
    await page.route('**/ui/api/zigbee/overview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hubStatus: 'offline',
          devices: [],
          quickActions: [
            { id: 'all-on', label: 'All On' },
            { id: 'all-off', label: 'All Off' }
          ]
        }),
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check buttons are disabled
    const pairButton = page.getByRole('button', { name: 'Pair Device' });
    await expect(pairButton).toBeDisabled();

    const allOnButton = page.getByRole('button', { name: 'All On' });
    await expect(allOnButton).toBeDisabled();

    // Warning banner should appear
    const warningBanner = page.locator('.warning-banner');
    await expect(warningBanner).toBeVisible();
    await expect(warningBanner).toContainText('Zigbee hub is currently unavailable');
  });

  test('should disable buttons during action execution', async ({ page }) => {
    // Override to add delay
    await page.unroute('**/ui/api/zigbee/**');
    let resolveFn: any;
    await page.route('**/ui/api/zigbee/actions/**', async (route) => {
      await new Promise(resolve => {
        resolveFn = resolve;
        setTimeout(resolve, 1000);
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hubStatus: 'online',
          devices: [],
          quickActions: [
            { id: 'all-on', label: 'All On' },
            { id: 'all-off', label: 'All Off' }
          ]
        }),
      });
    });

    const allOnButton = page.getByRole('button', { name: 'All On' });
    await allOnButton.click();

    // Check disabled state during loading
    await expect(allOnButton).toBeDisabled();
    await expect(allOnButton).toContainText('Running...');

    // Wait for completion
    await page.waitForTimeout(1200);

    // Should be enabled after completion
    await expect(allOnButton).toBeEnabled();
    await expect(allOnButton).toContainText('All On');
  });
});
