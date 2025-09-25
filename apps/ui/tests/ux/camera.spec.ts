import { expect, test } from '@playwright/test';

test.describe('Camera UX', () => {
  test('renders placeholder reason when preview is unavailable', async ({ page }) => {
    await page.goto('/camera');
    const placeholder = page.getByRole('status', { name: /Preview unavailable/ });
    await expect(placeholder).toContainText('Preview unavailable');
    await expect(placeholder).toContainText('MediaMTX not integrated');
  });
});
