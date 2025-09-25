import { expect, test } from '@playwright/test';

const waitForRows = async (page: import('@playwright/test').Page) => {
  const list = page.locator('.log-list li');
  await expect(list.first()).toBeVisible();
  return list;
};

test.describe('Logs workflow', () => {
  test('filters severity and can trigger exports', async ({ page }) => {
    await page.goto('/logs');
    const list = await waitForRows(page);

    const initialCount = await list.count();
    expect(initialCount).toBeGreaterThan(0);

    await page.locator('label:has-text("Severity") select').selectOption('error');
    await page.waitForTimeout(350);

    const errorStatuses = await page.locator('.log-entry .status[data-status="error"]').count();
    expect(errorStatuses).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Export JSON' }).click();
    await expect(page.getByRole('button', { name: 'Export JSON' })).toBeEnabled();
  });
});
