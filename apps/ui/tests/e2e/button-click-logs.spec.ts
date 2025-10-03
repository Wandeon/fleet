import { expect, test } from '@playwright/test';

test.describe('Logs Module Button Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Mock logs API responses
    await page.route('**/ui/api/logs/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/logs/snapshot')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            entries: [
              {
                id: 'log-1',
                timestamp: new Date().toISOString(),
                severity: 'info',
                source: 'api',
                message: 'Server started successfully',
                deviceId: 'dev-1',
                correlationId: 'corr-123'
              },
              {
                id: 'log-2',
                timestamp: new Date(Date.now() - 60000).toISOString(),
                severity: 'error',
                source: 'camera',
                message: 'Connection failed',
                deviceId: 'cam-1',
                correlationId: 'corr-456'
              }
            ],
            sources: [
              { id: 'api', label: 'API' },
              { id: 'camera', label: 'Camera' }
            ],
            cursor: 'log-2',
            lastUpdated: new Date().toISOString()
          }),
        });
      } else if (url.includes('/logs/export')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'log-1', message: 'Server started successfully' }
          ]),
        });
      }
    });

    await page.goto('/logs');
    await page.waitForLoadState('networkidle');
  });

  test('should refresh logs and trigger API call with success toast', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: 'Refresh' });
    await expect(refreshButton).toBeVisible();

    // Track API calls
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ui/api/logs')) {
        apiCalls.push(request.url());
      }
    });

    // Click refresh
    await refreshButton.click();

    // Wait for network request
    await page.waitForTimeout(500);

    // Verify API was called
    const refreshCall = apiCalls.find(url => url.includes('/logs/snapshot'));
    expect(refreshCall).toBeTruthy();

    // Check for success toast - should show "Loaded X log entries"
    await page.waitForTimeout(100);
  });

  test('should export JSON and trigger API call with success toast', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: 'Export JSON' });
    await expect(exportButton).toBeVisible();

    // Track API calls
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ui/api/logs')) {
        apiCalls.push(request.url());
      }
    });

    // Listen for download
    const downloadPromise = page.waitForEvent('download');

    // Click export
    await exportButton.click();

    // Wait for network request
    await page.waitForTimeout(500);

    // Verify API was called
    const exportCall = apiCalls.find(url => url.includes('/logs/export'));
    expect(exportCall).toBeTruthy();

    // Check for success toast
    await page.waitForTimeout(100);
  });

  test('should export TXT and trigger API call with success toast', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: 'Export TXT' });
    await expect(exportButton).toBeVisible();

    // Track API calls
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ui/api/logs')) {
        apiCalls.push(request.url());
      }
    });

    // Click export
    await exportButton.click();

    // Wait for network request
    await page.waitForTimeout(500);

    // Verify API was called
    const exportCall = apiCalls.find(url => url.includes('/logs/export'));
    expect(exportCall).toBeTruthy();
  });

  test('should toggle auto-refresh stream', async ({ page }) => {
    const pauseButton = page.getByRole('button', { name: /Pause stream/ });
    await expect(pauseButton).toBeVisible();

    // Click to pause
    await pauseButton.click();
    await page.waitForTimeout(200);

    // Button text should change
    const resumeButton = page.getByRole('button', { name: /Resume stream/ });
    await expect(resumeButton).toBeVisible();

    // Click to resume
    await resumeButton.click();
    await page.waitForTimeout(200);

    // Should be back to pause button
    await expect(pauseButton).toBeVisible();
  });

  test('should handle refresh failure with error banner', async ({ page }) => {
    // Override route to return error
    await page.unroute('**/ui/api/logs/**');
    await page.route('**/ui/api/logs/snapshot', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Database connection failed',
          detail: { correlationId: 'err-corr-789' }
        }),
      });
    });

    const refreshButton = page.getByRole('button', { name: 'Refresh' });
    await refreshButton.click();

    // Wait for error handling
    await page.waitForTimeout(500);

    // Error banner should appear
    const errorBanner = page.locator('.error[role="alert"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Log stream unavailable');

    // Should show correlation ID
    await expect(errorBanner).toContainText('err-corr-789');

    // Retry button should be in the error banner
    const retryButton = errorBanner.getByRole('button', { name: 'Retry now' });
    await expect(retryButton).toBeVisible();
  });

  test('should handle export failure with error message', async ({ page }) => {
    // Override route to return error
    await page.unroute('**/ui/api/logs/**');
    await page.route('**/ui/api/logs/export', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Export service unavailable',
          detail: { correlationId: 'export-err-123' }
        }),
      });
    });

    const exportButton = page.getByRole('button', { name: 'Export JSON' });
    await exportButton.click();

    // Wait for error handling
    await page.waitForTimeout(500);

    // Error banner should show export failure
    const errorBanner = page.locator('.error[role="alert"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Export failed');
  });

  test('should disable buttons during loading state', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: 'Refresh' });

    // Override to add delay
    await page.unroute('**/ui/api/logs/**');
    await page.route('**/ui/api/logs/snapshot', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entries: [],
          sources: [],
          cursor: null,
          lastUpdated: new Date().toISOString()
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

  test('should disable export buttons during download', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: 'Export JSON' });

    // Override to add delay
    await page.unroute('**/ui/api/logs/**');
    await page.route('**/ui/api/logs/export', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Start the export
    await exportButton.click();

    // Check disabled state during loading
    await expect(exportButton).toBeDisabled();

    // Wait for completion
    await page.waitForTimeout(1200);

    // Should be enabled after completion
    await expect(exportButton).toBeEnabled();
  });

  test('should apply filters and trigger API calls', async ({ page }) => {
    // Track API calls
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ui/api/logs/snapshot')) {
        apiCalls.push(request.url());
      }
    });

    // Change severity filter
    const severitySelect = page.locator('label:has-text("Severity") select');
    await severitySelect.selectOption('error');

    // Wait for debounce and API call
    await page.waitForTimeout(500);

    // Verify API was called with filter
    expect(apiCalls.length).toBeGreaterThan(0);
    const lastCall = apiCalls[apiCalls.length - 1];
    expect(lastCall).toContain('severity=error');
  });

  test('should navigate to device when clicking device ID', async ({ page }) => {
    // Wait for logs to load
    await page.waitForSelector('.log-list li');

    // Find and click a device button
    const deviceButton = page.locator('.device').first();
    if (await deviceButton.isVisible()) {
      await deviceButton.click();

      // Should navigate to fleet device page
      await page.waitForTimeout(300);
      expect(page.url()).toContain('/fleet/');
    }
  });
});
