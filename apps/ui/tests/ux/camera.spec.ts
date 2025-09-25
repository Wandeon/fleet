import { expect, test } from '@playwright/test';

test.describe('Camera workflow', () => {
  test('switches cameras and allows acknowledgement', async ({ page }) => {
    await page.goto('/camera');

    const cards = page.locator('.devices button');
    await expect(cards.first()).toBeVisible();

    await cards.nth(1).click();
    await expect(page.locator('.events li').first()).toBeVisible();

    const ackButton = page.locator('.event-actions button', { hasText: 'Acknowledge' }).first();
    if (await ackButton.isVisible()) {
      await ackButton.click();
    }

    await page.getByRole('button', { name: 'Refresh preview' }).click();
    await expect(page.locator('.clips button').first()).toBeVisible();
  });
});
