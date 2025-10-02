import { expect, test } from '@playwright/test';

test.describe('Logs Module Button Interactions', () => {
  test.beforeEach(async ({ page }) => {
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
              }
            ],
            sources: [{ id: 'api', label: 'API' }],
            cursor: 'log-1',
            lastUpdated: new Date().toISOString()
          }),
        });
      } else if (url.includes('/logs/export')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'log-1', message: 'Server started successfully' }]),
        });
      }
    });

    await page.goto('/logs');
    await page.waitForLoadState('networkidle');
  });

  test('should refresh logs and trigger API call', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: 'Refresh' });
    await expect(refreshButton).toBeVisible();

    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ui/api/logs')) {
        apiCalls.push(request.url());
      }
    });

    await refreshButton.click();
    await page.waitForTimeout(500);

    const refreshCall = apiCalls.find(url => url.includes('/logs/snapshot'));
    expect(refreshCall).toBeTruthy();
  });

  test('should export JSON and trigger API call', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: 'Export JSON' });
    await expect(exportButton).toBeVisible();

    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ui/api/logs')) {
        apiCalls.push(request.url());
      }
    });

    await exportButton.click();
    await page.waitForTimeout(500);

    const exportCall = apiCalls.find(url => url.includes('/logs/export'));
    expect(exportCall).toBeTruthy();
  });

  test('should toggle auto-refresh stream', async ({ page }) => {
    const pauseButton = page.getByRole('button', { name: /Pause stream/ });
    await expect(pauseButton).toBeVisible();

    await pauseButton.click();
    await page.waitForTimeout(200);

    const resumeButton = page.getByRole('button', { name: /Resume stream/ });
    await expect(resumeButton).toBeVisible();
  });
});
