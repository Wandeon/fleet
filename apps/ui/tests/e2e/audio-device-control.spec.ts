import { expect, test } from '@playwright/test';

test.describe('Audio Device Controls', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the devices list endpoint
    await page.route('**/ui/audio/devices', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          devices: [
            {
              id: 'pi-audio-01',
              name: 'Audio Player 01',
              status: 'online',
              volumePercent: 80,
              playback: {
                state: 'idle',
                trackId: null,
                trackTitle: null,
                playlistId: null,
                positionSeconds: 0,
                durationSeconds: 0,
                startedAt: null,
                syncGroup: null,
                lastError: null,
              },
              lastUpdated: new Date().toISOString(),
              fallbackExists: true,
            },
            {
              id: 'pi-audio-02',
              name: 'Audio Player 02',
              status: 'online',
              volumePercent: 75,
              playback: {
                state: 'idle',
                trackId: null,
                trackTitle: null,
                playlistId: null,
                positionSeconds: 0,
                durationSeconds: 0,
                startedAt: null,
                syncGroup: null,
                lastError: null,
              },
              lastUpdated: new Date().toISOString(),
              fallbackExists: false,
            },
          ],
          total: 2,
        }),
      })
    );

    await page.goto('/audio');
    await expect(page.getByRole('heading', { name: 'Audio Device Controls' })).toBeVisible();
  });

  test('displays device control cards for all devices', async ({ page }) => {
    await expect(page.getByText('Audio Player 01')).toBeVisible();
    await expect(page.getByText('Audio Player 02')).toBeVisible();
    await expect(page.getByText('pi-audio-01')).toBeVisible();
    await expect(page.getByText('pi-audio-02')).toBeVisible();
  });

  test('shows fallback status for each device', async ({ page }) => {
    const cards = page.locator('.device-card');
    const card1 = cards.filter({ hasText: 'Audio Player 01' });
    const card2 = cards.filter({ hasText: 'Audio Player 02' });

    await expect(card1.getByText(/Ready/)).toBeVisible();
    await expect(card2.getByText(/None/)).toBeVisible();
  });

  test('can play stream on device', async ({ page }) => {
    await page.route('**/ui/audio/devices/pi-audio-01/play', (route) => {
      const requestBody = route.request().postDataJSON();
      expect(requestBody.source).toBe('stream');
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ source: 'stream', mode: 'auto' }),
      });
    });

    const card = page.locator('.device-card').filter({ hasText: 'Audio Player 01' });
    await card.getByRole('button', { name: 'Play Stream' }).click();

    await expect(page.getByText(/Playing stream on Audio Player 01/)).toBeVisible();
  });

  test('can play file on device when fallback exists', async ({ page }) => {
    await page.route('**/ui/audio/devices/pi-audio-01/play', (route) => {
      const requestBody = route.request().postDataJSON();
      expect(requestBody.source).toBe('file');
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ source: 'file', mode: 'manual' }),
      });
    });

    const card = page.locator('.device-card').filter({ hasText: 'Audio Player 01' });
    await card.getByRole('button', { name: 'Play File' }).click();

    await expect(page.getByText(/Playing fallback file on Audio Player 01/)).toBeVisible();
  });

  test('disables Play File button when no fallback exists', async ({ page }) => {
    const card = page.locator('.device-card').filter({ hasText: 'Audio Player 02' });
    const playFileButton = card.getByRole('button', { name: 'Play File' });

    await expect(playFileButton).toBeDisabled();
  });

  test('can stop device playback', async ({ page }) => {
    await page.route('**/ui/audio/devices/pi-audio-01/stop', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    );

    const card = page.locator('.device-card').filter({ hasText: 'Audio Player 01' });
    await card.getByRole('button', { name: 'Stop' }).click();

    await expect(page.getByText(/Stopped Audio Player 01/)).toBeVisible();
  });

  test('shows error toast for offline device', async ({ page }) => {
    await page.route('**/ui/audio/devices/pi-audio-01/play', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'text/plain',
        body: 'upstream_unreachable',
      })
    );

    const card = page.locator('.device-card').filter({ hasText: 'Audio Player 01' });
    await card.getByRole('button', { name: 'Play Stream' }).click();

    await expect(page.getByText('Device offline or unreachable')).toBeVisible();
  });

  test('verifies no console errors on button clicks', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const card = page.locator('.device-card').filter({ hasText: 'Audio Player 01' });
    await card.getByRole('button', { name: 'Play Stream' }).click();

    // Wait a bit for any console errors to appear
    await page.waitForTimeout(500);

    // No console errors should be present when clicking buttons
    expect(consoleErrors).toHaveLength(0);
  });
});
