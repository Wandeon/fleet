import { expect, test } from '@playwright/test';

test.describe('Dashboard smoke', () => {
  test('renders core modules and proxies browser API requests through /ui', async ({ page }) => {
    const apiRequests: string[] = [];
    await page.route('**/*', (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.startsWith('/api/')) {
        apiRequests.push(route.request().url());
      }
      route.continue();
    });

    const proxyResponses: { url: string; status: number }[] = [];
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/ui/')) {
        proxyResponses.push({ url, status: response.status() });
      }
    });

    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Audio', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Video', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Zigbee', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /Camera/, exact: false })).toBeVisible();

    const [stateStatus, layoutStatus] = await page.evaluate(async () => {
      const [state, layout] = await Promise.all([
        fetch('/ui/fleet/state'),
        fetch('/ui/fleet/layout'),
      ]);
      return [state.status, layout.status];
    });

    expect(stateStatus).toBe(200);
    expect(layoutStatus).toBe(200);
    expect(apiRequests).toHaveLength(0);

    const paths = proxyResponses.map((entry) => new URL(entry.url).pathname);
    expect(paths).toEqual(expect.arrayContaining(['/ui/fleet/state', '/ui/fleet/layout']));
    for (const entry of proxyResponses) {
      if (entry.url.includes('/ui/')) {
        expect(entry.status, `unexpected status for ${entry.url}`).not.toBe(401);
      }
    }
    expect(consoleErrors.filter((msg) => msg.includes('401'))).toHaveLength(0);
  });

  test('uses mocked data by default', async ({ page }) => {
    await page.goto('/logs');
    const event = page.getByText('pi-audio-01 acknowledged volume change');
    await expect(event).toBeVisible();
  });
});
