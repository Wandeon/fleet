import { expect, test } from '@playwright/test';

test.describe('SSR safeguards', () => {
  test('home page renders without internal error banner and SSR proxy stays healthy', async ({
    page,
  }) => {
    const stateResponse = await page.request.get('/ui/fleet/state');
    expect(stateResponse.ok()).toBeTruthy();
    expect(new URL(stateResponse.url()).pathname).toBe('/ui/fleet/state');
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
