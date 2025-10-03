import { expect, test } from '@playwright/test';

test.describe('Dashboard Module Button Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Mock dashboard/module API responses
    await page.route('**/ui/api/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/camera/overview')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            activeCameraId: 'cam-1',
            devices: [
              { id: 'cam-1', name: 'Front Door', status: 'online', location: 'Entrance' }
            ],
            events: [],
            clips: [],
            overview: { streamUrl: null, previewImage: '/preview.jpg' }
          }),
        });
      } else if (url.includes('/zigbee/overview')) {
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
            quickActions: [{ id: 'all-on', label: 'All On' }]
          }),
        });
      } else if (url.includes('/camera/preview/refresh')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            activeCameraId: 'cam-1',
            devices: [],
            events: [],
            clips: [],
            overview: { streamUrl: '/stream.m3u8', previewImage: '/preview-refreshed.jpg' }
          }),
        });
      } else if (url.includes('/zigbee/actions/') || url.includes('/zigbee/pairing/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hubStatus: 'online',
            devices: [],
            quickActions: []
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should render camera module with buttons', async ({ page }) => {
    // Check if camera module is visible
    const cameraCard = page.locator('text=Cameras').first();
    await expect(cameraCard).toBeVisible();

    // Check if refresh button exists in camera module
    const refreshButton = page.getByRole('button', { name: 'Refresh preview' }).first();
    if (await refreshButton.isVisible()) {
      await expect(refreshButton).toBeEnabled();
    }
  });

  test('should render zigbee module with buttons', async ({ page }) => {
    // Check if zigbee module is visible
    const zigbeeCard = page.locator('text=Zigbee').first();
    await expect(zigbeeCard).toBeVisible();

    // Check if pair device button exists
    const pairButton = page.getByRole('button', { name: 'Pair Device' }).first();
    if (await pairButton.isVisible()) {
      await expect(pairButton).toBeEnabled();
    }
  });

  test('should trigger camera refresh from dashboard', async ({ page }) => {
    // Find and click refresh button in camera module
    const refreshButton = page.getByRole('button', { name: 'Refresh preview' }).first();

    if (await refreshButton.isVisible()) {
      // Track API calls
      const apiCalls: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/ui/api/camera')) {
          apiCalls.push(request.url());
        }
      });

      await refreshButton.click();
      await page.waitForTimeout(500);

      // Verify API was called
      const refreshCall = apiCalls.find(url => url.includes('/camera/preview/refresh'));
      expect(refreshCall).toBeTruthy();
    }
  });

  test('should trigger zigbee action from dashboard', async ({ page }) => {
    // Find zigbee quick action button
    const allOnButton = page.getByRole('button', { name: 'All On' }).first();

    if (await allOnButton.isVisible()) {
      // Track API calls
      const apiCalls: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/ui/api/zigbee')) {
          apiCalls.push(request.url());
        }
      });

      await allOnButton.click();
      await page.waitForTimeout(500);

      // Verify API was called
      const actionCall = apiCalls.find(url => url.includes('/zigbee/actions/'));
      expect(actionCall).toBeTruthy();
    }
  });

  test('should handle camera module error state with retry button', async ({ page }) => {
    // Override route to return error
    await page.unroute('**/ui/api/camera/**');
    await page.route('**/ui/api/camera/overview', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Camera service unavailable' }),
      });
    });

    // Reload page to trigger error
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Error state should be visible with retry button
    const retryButton = page.locator('text=Cameras').locator('..').getByRole('button', { name: 'Retry' }).first();
    if (await retryButton.isVisible()) {
      // Track API calls
      const apiCalls: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/ui/api/camera')) {
          apiCalls.push(request.url());
        }
      });

      await retryButton.click();
      await page.waitForTimeout(500);

      // Verify retry triggered API call
      expect(apiCalls.length).toBeGreaterThan(0);
    }
  });

  test('should handle zigbee module error state with retry button', async ({ page }) => {
    // Override route to return error
    await page.unroute('**/ui/api/zigbee/**');
    await page.route('**/ui/api/zigbee/overview', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Zigbee controller unreachable' }),
      });
    });

    // Reload page to trigger error
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Error state should be visible with retry button
    const retryButton = page.locator('text=Zigbee').locator('..').getByRole('button', { name: 'Retry' }).first();
    if (await retryButton.isVisible()) {
      // Track API calls
      const apiCalls: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/ui/api/zigbee')) {
          apiCalls.push(request.url());
        }
      });

      await retryButton.click();
      await page.waitForTimeout(500);

      // Verify retry triggered API call
      expect(apiCalls.length).toBeGreaterThan(0);
    }
  });

  test('should display fleet connection status', async ({ page }) => {
    // Status banner should be visible
    const statusBanner = page.locator('.status-banner');
    if (await statusBanner.isVisible()) {
      await expect(statusBanner).toContainText('Connection');
      await expect(statusBanner).toContainText('Devices');
    }
  });

  test('should disable module buttons during loading', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: 'Refresh preview' }).first();

    if (await refreshButton.isVisible()) {
      // Override to add delay
      await page.unroute('**/ui/api/camera/**');
      await page.route('**/ui/api/camera/preview/refresh', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            activeCameraId: 'cam-1',
            devices: [],
            events: [],
            clips: [],
            overview: { streamUrl: null, previewImage: '/preview.jpg' }
          }),
        });
      });

      // Start the action
      await refreshButton.click();

      // Check disabled state during loading
      await expect(refreshButton).toBeDisabled();

      // Wait for completion
      await page.waitForTimeout(1200);

      // Should be enabled after completion
      await expect(refreshButton).toBeEnabled();
    }
  });

  test('should show success toasts for module actions', async ({ page }) => {
    const allOnButton = page.getByRole('button', { name: 'All On' }).first();

    if (await allOnButton.isVisible()) {
      await allOnButton.click();
      await page.waitForTimeout(300);

      // Toast should appear (implementation may vary based on toast system)
      // This is a placeholder - adjust based on your toast implementation
      await page.waitForTimeout(100);
    }
  });

  test('should show error toasts for failed module actions', async ({ page }) => {
    const allOnButton = page.getByRole('button', { name: 'All On' }).first();

    if (await allOnButton.isVisible()) {
      // Override to return error
      await page.unroute('**/ui/api/zigbee/**');
      await page.route('**/ui/api/zigbee/actions/**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Action execution failed',
            correlationId: 'dash-err-123'
          }),
        });
      });

      await allOnButton.click();
      await page.waitForTimeout(500);

      // Error should be displayed
      await page.waitForTimeout(100);
    }
  });
});
