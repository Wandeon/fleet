import { expect, test } from '@playwright/test';

test.describe('Audio daily operations', () => {
  test('runs playback controls through /ui D1 endpoints', async ({ page }) => {
    const apiRequests: string[] = [];
    const uiRequests: { method: string; url: string; body?: unknown }[] = [];

    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        apiRequests.push(`${request.method()} ${url.pathname}`);
      }
      if (url.pathname.startsWith('/ui/')) {
        let body: unknown;
        try {
          body = request.postDataJSON();
        } catch {
          body = undefined;
        }
        uiRequests.push({ method: request.method(), url: url.pathname, body });
      }
    });

    await page.goto('/audio');
    await expect(page.getByRole('heading', { name: 'Audio' })).toBeVisible();

    // Create a playlist to reuse later in the flow.
    await page.getByRole('button', { name: 'New playlist' }).click();
    const playlistDialog = page.getByRole('dialog', { name: 'New playlist' });
    await expect(playlistDialog).toBeVisible();

    await playlistDialog.getByLabel('Name').fill('Daily Ops Mix');
    await playlistDialog.getByLabel('Description').fill('End-to-end flow verification');
    await playlistDialog.getByLabel('Sync mode').selectOption('synced');
    await playlistDialog.getByLabel('Loop playlist').check();
    await playlistDialog.getByRole('checkbox', { name: 'Soft Rain' }).check();
    await playlistDialog.getByRole('checkbox', { name: 'City Skyline' }).check();
    await playlistDialog.getByRole('button', { name: 'Create playlist' }).click();
    await expect(playlistDialog).toBeHidden();
    await expect(page.getByText('Playlist “Daily Ops Mix” created')).toBeVisible();

    // Single-device playback.
    await page.getByRole('button', { name: 'Select' }).first().click();
    await page
      .getByRole('row', { name: /Soft Rain/ })
      .getByRole('button', { name: 'Play on selected' })
      .click();
    await expect(page.getByRole('button', { name: 'Pause' }).first()).toBeVisible();
    await expect(page.getByText('Playing')).toBeVisible();

    // Pause and resume to exercise device control endpoints.
    await page.getByRole('button', { name: 'Pause' }).first().click();
    await page.waitForResponse('**/ui/audio/devices/pi-audio-01/pause');
    await expect(page.getByText('Paused')).toBeVisible();
    await page.getByRole('button', { name: 'Play' }).first().click();
    await page.waitForResponse('**/ui/audio/devices/pi-audio-01/resume');
    await expect(page.getByText('Playing')).toBeVisible();

    // Seek and volume adjustments.
    await page.getByLabel('Seek').first().fill('45');
    await page.waitForResponse('**/ui/audio/devices/pi-audio-01/seek');

    await page.getByLabel('Volume').first().fill('150');
    await page.waitForResponse('**/ui/audio/devices/pi-audio-01/volume');

    await page.getByLabel('Master volume').fill('150');
    await page.waitForResponse('**/ui/audio/master-volume');

    // Add a second device and run independent assignments.
    await page.getByRole('button', { name: 'Select' }).nth(1).click();
    await page.getByRole('button', { name: 'Per device' }).click();
    const assignmentSelects = page.locator('.mode-content.per-device select');
    await assignmentSelects.first().selectOption('track-soft-rain');
    await assignmentSelects.nth(1).selectOption('track-city-skyline');
    await page.getByLabel('Sync mode').selectOption('independent');
    await page.getByRole('button', { name: 'Start playback' }).click();
    await page.waitForResponse('**/ui/audio/playback');
    await expect(page.getByRole('button', { name: 'Start playback' })).toBeEnabled();

    // Deploy synced playlist session.
    await page.getByRole('button', { name: 'Playlist' }).click();
    await page.getByLabel('Playlist').selectOption({ label: 'Daily Ops Mix' });
    await page.getByLabel('Sync mode').selectOption('synced');
    await page.getByRole('button', { name: 'Start playback' }).click();
    await page.waitForResponse('**/ui/audio/playback');
    await expect(page.getByRole('button', { name: 'Start playback' })).toBeEnabled();

    // Trigger a manual re-sync on the lead device.
    await page.getByRole('button', { name: 'Re-sync' }).first().click();
    await page.waitForResponse('**/ui/audio/playback');

    // Stop playback on the lead device.
    await page.getByRole('button', { name: 'Stop' }).first().click();
    await page.waitForResponse('**/ui/audio/devices/pi-audio-01/stop');
    await expect(page.getByText('Idle')).toBeVisible();

    expect(apiRequests).toEqual([]);

    const requestPaths = uiRequests.map((entry) => `${entry.method} ${entry.url}`);
    expect(requestPaths).toEqual(
      expect.arrayContaining([
        'GET /ui/audio/overview',
        'POST /ui/audio/playback',
        'POST /ui/audio/devices/pi-audio-01/pause',
        'POST /ui/audio/devices/pi-audio-01/resume',
        'POST /ui/audio/devices/pi-audio-01/seek',
        'POST /ui/audio/devices/pi-audio-01/volume',
        'POST /ui/audio/master-volume',
        'POST /ui/audio/playlists',
        'POST /ui/audio/devices/pi-audio-01/stop',
      ])
    );
  });
});
