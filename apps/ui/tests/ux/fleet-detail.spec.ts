import { expect, test } from '@playwright/test';

test.describe('Fleet detail UX', () => {
  test('navigates to device detail and surfaces log excerpt', async ({ page }) => {
    await page.goto('/fleet');
    const lobbyLink = page.getByRole('link', { name: /Lobby Speakers/ });
    await expect(lobbyLink).toBeVisible();
    await lobbyLink.click();

    await expect(page.getByRole('heading', { name: 'Lobby Speakers' })).toBeVisible();
    await expect(page.locator('.status.online')).toContainText('Online');
    await expect(page.locator('.log-list')).toContainText('acknowledged volume change');
  });
});
