import { expect, test } from '@playwright/test';

test.describe('Fleet device detail', () => {
  test('runs quick actions and navigates to logs', async ({ page }) => {
    await page.goto('/fleet');
    const deviceCard = page.locator('.device-card').first();
    await expect(deviceCard).toBeVisible();
    const deviceName = await deviceCard.locator('h3').textContent();
    await deviceCard.click();

    await expect(page.locator('.header h1')).toHaveText(deviceName ?? /.+/);

    const actionButton = page.locator('.actions button').first();
    await expect(actionButton).toBeVisible();
    await actionButton.click();
    await page.waitForTimeout(400);
    await expect(page.locator('.logs li').first()).toBeVisible();

    const logLink = page.locator('a.link');
    await expect(logLink).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/logs/),
      logLink.click()
    ]);
    await expect(page).toHaveURL(/\/logs/);
  });
});
