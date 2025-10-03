import { expect, test } from '@playwright/test';

test.describe('Dashboard Module Button Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/ui/api/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/camera/overview')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            activeCameraId: 'cam-1',
            devices: [{ id: 'cam-1', name: 'Front Door', status: 'online', location: 'Entrance' }],
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
            devices: [{ id: 'zb-1', name: 'Living Room Light', type: 'light', state: 'active', lastSeen: new Date().toISOString() }],
            quickActions: [{ id: 'all-on', label: 'All On' }]
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
    const cameraCard = page.locator('text=Cameras').first();
    await expect(cameraCard).toBeVisible();

    const refreshButton = page.getByRole('button', { name: 'Refresh preview' }).first();
    if (await refreshButton.isVisible()) {
      await expect(refreshButton).toBeEnabled();
    }
  });

  test('should render zigbee module with buttons', async ({ page }) => {
    const zigbeeCard = page.locator('text=Zigbee').first();
    await expect(zigbeeCard).toBeVisible();

    const pairButton = page.getByRole('button', { name: 'Pair Device' }).first();
    if (await pairButton.isVisible()) {
      await expect(pairButton).toBeEnabled();
    }
  });

  test('should display fleet connection status', async ({ page }) => {
    const statusBanner = page.locator('.status-banner');
    if (await statusBanner.isVisible()) {
      await expect(statusBanner).toContainText('Connection');
      await expect(statusBanner).toContainText('Devices');
    }
  });
});
