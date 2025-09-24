import { expect, test } from '@playwright/test';

test.describe('SSR safeguards', () => {
  test('home page renders without internal error banner and fleet state endpoint is healthy', async ({ page }) => {
    const stateResponse = await page.request.get('/api/fleet/state');
    expect(stateResponse.ok()).toBeTruthy();
    const payload = await stateResponse.json();
    expect(payload).toMatchObject({
      connection: expect.objectContaining({
        status: expect.any(String),
      }),
      build: expect.objectContaining({
        version: expect.any(String),
      }),
    });

    await page.goto('/');
    await expect(page.getByText('Internal Error')).toHaveCount(0);
  });
});

