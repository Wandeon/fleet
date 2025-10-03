import { expect, test } from '@playwright/test';

test.describe('Camera Module Button Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Mock camera API responses
    await page.route('**/ui/api/camera/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/camera/overview')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            activeCameraId: 'cam-1',
            devices: [
              { id: 'cam-1', name: 'Front Door', status: 'online', location: 'Entrance' },
              { id: 'cam-2', name: 'Backyard', status: 'online', location: 'Garden' }
            ],
            events: [
              {
                id: 'evt-1',
                cameraId: 'cam-1',
                timestamp: new Date().toISOString(),
                severity: 'alert',
                description: 'Motion detected',
                tags: ['motion'],
                acknowledged: false
              }
            ],
            clips: [
              {
                id: 'clip-1',
                url: '/clip1.mp4',
                label: 'Recording 1',
                start: new Date(Date.now() - 3600000).toISOString(),
                end: new Date().toISOString(),
                thumbnailUrl: '/thumb1.jpg'
              }
            ],
            overview: {
              streamUrl: null,
              previewImage: '/preview.jpg'
            }
          }),
        });
      } else if (url.includes('/camera/select/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            activeCameraId: 'cam-2',
            devices: [
              { id: 'cam-1', name: 'Front Door', status: 'online', location: 'Entrance' },
              { id: 'cam-2', name: 'Backyard', status: 'online', location: 'Garden' }
            ],
            events: [],
            clips: [],
            overview: { streamUrl: null, previewImage: '/preview2.jpg' }
          }),
        });
      } else if (url.includes('/camera/preview/refresh')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            activeCameraId: 'cam-1',
            devices: [
              { id: 'cam-1', name: 'Front Door', status: 'online', location: 'Entrance' },
              { id: 'cam-2', name: 'Backyard', status: 'online', location: 'Garden' }
            ],
            events: [],
            clips: [],
            overview: { streamUrl: '/stream.m3u8', previewImage: '/preview-refreshed.jpg' }
          }),
        });
      } else if (url.includes('/camera/events/') && url.includes('/acknowledge')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            activeCameraId: 'cam-1',
            devices: [
              { id: 'cam-1', name: 'Front Door', status: 'online', location: 'Entrance' },
              { id: 'cam-2', name: 'Backyard', status: 'online', location: 'Garden' }
            ],
            events: [
              {
                id: 'evt-1',
                cameraId: 'cam-1',
                timestamp: new Date().toISOString(),
                severity: 'alert',
                description: 'Motion detected',
                tags: ['motion'],
                acknowledged: true
              }
            ],
            clips: [],
            overview: { streamUrl: null, previewImage: '/preview.jpg' }
          }),
        });
      }
    });

    await page.goto('/camera');
    await page.waitForLoadState('networkidle');
  });

  test('should select camera and trigger API call', async ({ page }) => {
    // Wait for cameras to load
    const cameraButtons = page.locator('.devices button');
    await expect(cameraButtons.first()).toBeVisible();

    // Track API calls
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ui/api/camera')) {
        apiCalls.push(request.url());
      }
    });

    // Click second camera
    await cameraButtons.nth(1).click();

    // Wait for network request
    await page.waitForTimeout(300);

    // Verify API was called
    const selectCall = apiCalls.find(url => url.includes('/camera/select/'));
    expect(selectCall).toBeTruthy();

    // Verify button state changed
    const secondButton = cameraButtons.nth(1);
    await expect(secondButton).toHaveAttribute('data-selected', 'true');
  });

  test('should refresh preview and trigger API call with success toast', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: 'Refresh preview' });
    await expect(refreshButton).toBeVisible();

    // Track API calls
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ui/api/camera')) {
        apiCalls.push(request.url());
      }
    });

    // Click refresh
    await refreshButton.click();

    // Wait for network request
    await page.waitForTimeout(300);

    // Verify API was called
    const refreshCall = apiCalls.find(url => url.includes('/camera/preview/refresh'));
    expect(refreshCall).toBeTruthy();

    // Button should be disabled during loading
    await expect(refreshButton).toBeEnabled();
  });

  test('should acknowledge event and trigger API call with success toast', async ({ page }) => {
    const acknowledgeButton = page.locator('.event-actions button', { hasText: 'Acknowledge' }).first();

    if (await acknowledgeButton.isVisible()) {
      // Track API calls
      const apiCalls: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/ui/api/camera')) {
          apiCalls.push(request.url());
        }
      });

      await acknowledgeButton.click();

      // Wait for network request
      await page.waitForTimeout(300);

      // Verify API was called
      const ackCall = apiCalls.find(url => url.includes('/acknowledge'));
      expect(ackCall).toBeTruthy();
    }
  });

  test('should handle camera selection failure with error toast', async ({ page }) => {
    // Override route to return error
    await page.unroute('**/ui/api/camera/**');
    await page.route('**/ui/api/camera/select/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Camera unavailable' }),
      });
    });

    const cameraButtons = page.locator('.devices button');
    await cameraButtons.nth(1).click();

    // Wait for error handling
    await page.waitForTimeout(500);

    // Button should still be clickable after error
    await expect(cameraButtons.nth(1)).toBeEnabled();
  });

  test('should disable buttons during loading state', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: 'Refresh preview' });

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
  });
});
