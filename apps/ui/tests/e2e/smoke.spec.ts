import { expect, test } from '@playwright/test';

test.describe('Dashboard smoke', () => {
  test('renders core modules', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Audio', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Video', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Zigbee', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Camera', exact: true })).toBeVisible();
    await expect(page.getByText('Mock states')).toBeVisible();
  });

  test('uses mocked data by default', async ({ page }) => {
    await page.goto('/logs');
    const event = page.getByText('pi-audio-01 acknowledged volume change');
    await expect(event).toBeVisible();
  });
});
