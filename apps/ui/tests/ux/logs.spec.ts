import { expect, test } from '@playwright/test';

const LOG_ROW_SELECTOR = '.log-body .log-row';

test.describe('Logs UX', () => {
  test('filters by level, searches correlation ID, and pauses/resumes stream', async ({ page }) => {
    await page.goto('/logs');
    await expect(page.locator(LOG_ROW_SELECTOR).first()).toBeVisible();

    const levelSelect = page.getByLabel('Level');
    await levelSelect.selectOption({ label: 'Errors only' });
    const errorEntry = page.getByText('Upstream timeout reaching pi-audio-02');
    await expect(errorEntry).toBeVisible();
    await expect(page.getByText('Operator muted lounge TV')).toHaveCount(0);

    await levelSelect.selectOption({ label: 'All levels' });

    const searchInput = page.getByPlaceholder('Search message, host, or correlation ID');
    await searchInput.fill('corr-video-2402');
    await expect(page.getByText('Operator muted lounge TV')).toBeVisible();

    await searchInput.fill('');

    const initialCount = await page.locator(LOG_ROW_SELECTOR).count();
    const toggleButton = page.getByRole('button', { name: 'Pause stream' });
    await toggleButton.click();
    await page.waitForTimeout(1600);
    await expect(page.locator(LOG_ROW_SELECTOR)).toHaveCount(initialCount);

    await page.getByRole('button', { name: 'Resume stream' }).click();
    await page.waitForTimeout(1600);
    expect(await page.locator(LOG_ROW_SELECTOR).count()).toBeGreaterThan(initialCount);
  });
});
