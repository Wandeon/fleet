import { expect, test } from '@playwright/test';

test.describe('Camera module stabilization', () => {
  test('camera overview loads without 404 errors', async ({ page }) => {
    const requestFailures: { url: string; status: number }[] = [];

    page.on('response', (response) => {
      if (response.status() >= 400) {
        requestFailures.push({
          url: response.url(),
          status: response.status()
        });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check camera module is visible
    await expect(
      page.getByRole('heading', { level: 2, name: /Camera/, exact: false })
    ).toBeVisible();

    // Verify camera devices are shown
    const cameraSection = page.locator('[data-module="camera"]');
    await expect(cameraSection).toBeVisible();

    // Check no API failures occurred
    const apiFailures = requestFailures.filter(f =>
      f.url.includes('/api/camera') ||
      f.url.includes('/ui/camera') ||
      f.url.includes('camera/overview') ||
      f.url.includes('camera/active')
    );

    if (apiFailures.length > 0) {
      console.log('Camera API failures:', apiFailures);
    }
    expect(apiFailures).toHaveLength(0);
  });

  test('camera navigation maintains state and shows device status', async ({ page }) => {
    await page.goto('/');

    // Navigate to camera section if available
    const cameraLink = page.getByRole('button', { name: /camera/i }).first();
    if (await cameraLink.isVisible()) {
      await cameraLink.click();

      // Check for proper status display
      const statusElements = page.locator('.status');
      await expect(statusElements.first()).toBeVisible();

      // Verify no broken state (empty device arrays causing UI errors)
      const errorMessages = page.locator('.error, .empty');
      if (await errorMessages.count() > 0) {
        const errorText = await errorMessages.first().textContent();
        // Empty state is OK, but errors are not
        expect(errorText).not.toContain('undefined');
        expect(errorText).not.toContain('null');
      }
    }
  });

  test('handles offline camera state gracefully', async ({ page }) => {
    await page.goto('/');

    // Check for offline status handling
    const offlineElements = page.locator('text=/offline|unavailable/i');
    if (await offlineElements.count() > 0) {
      // Offline state should show clear messaging
      await expect(offlineElements.first()).toBeVisible();

      // Should not show broken property access
      const pageContent = await page.textContent('body');
      expect(pageContent).not.toContain('[object Object]');
      expect(pageContent).not.toContain('undefined');
    }
  });
});