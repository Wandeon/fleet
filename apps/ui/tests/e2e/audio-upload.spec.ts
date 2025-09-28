import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

test.describe('Audio fallback uploads', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/audio');
    await expect(page.getByRole('heading', { name: 'Audio' })).toBeVisible();
  });

  test('allows uploading fallback audio to a device', async ({ page }) => {
    await page.route('**/ui/audio/devices/pi-audio-01/upload', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          deviceId: 'pi-audio-01',
          fallbackExists: true,
          saved: true,
          path: '/data/fallback.mp3',
        }),
      })
    );

    await page.route('**/ui/audio/devices/pi-audio-01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'pi-audio-01',
          name: 'Lobby Speakers',
          status: 'online',
          group: 'lobby',
          volumePercent: 72,
          capabilities: ['upload'],
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
        }),
      });
      await page.unroute('**/ui/audio/devices/pi-audio-01');
    });

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Upload fallback' }).first().click(),
    ]);

    await chooser.setFiles({
      name: 'fallback.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from('audio-bytes'),
    });

    await expect(page.getByText('Upload successful')).toBeVisible();
    await expect(page.getByText('Fallback ready').first()).toBeVisible();
  });

  test('blocks files that exceed the size limit', async ({ page }) => {
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Upload fallback' }).first().click(),
    ]);

    await chooser.setFiles({
      name: 'big.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.alloc(50 * 1024 * 1024 + 1),
    });

    await expect(page.getByText('File too large. Maximum size is 50 MB.')).toBeVisible();
  });

  test('surfaces device offline errors', async ({ page }) => {
    await page.route('**/ui/audio/devices/pi-audio-01/upload', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'upstream_unreachable', message: 'Device unreachable' }),
      })
    );

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Upload fallback' }).first().click(),
    ]);

    await chooser.setFiles({
      name: 'fallback.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from('audio-bytes'),
    });

    await expect(page.getByText('Device offline. Check power or network and retry.')).toBeVisible();
  });
});
