import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchAudioDevices,
  playDeviceSource,
  stopDevice,
  setDeviceVolume,
  uploadDeviceFallback,
  getDeviceConfig,
  updateDeviceConfig,
} from './audio-device-control';
import { UiApiError } from './client';

global.fetch = vi.fn();

describe('audio-device-control', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchAudioDevices', () => {
    it('should fetch devices list', async () => {
      const mockDevices = [
        { id: 'pi-audio-01', name: 'Audio Player 01', status: 'online' },
        { id: 'pi-audio-02', name: 'Audio Player 02', status: 'online' },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ devices: mockDevices, total: 2 }),
      });

      const devices = await fetchAudioDevices();

      expect(devices).toEqual(mockDevices);
      expect(global.fetch).toHaveBeenCalledWith(
        '/ui/audio/devices',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should throw UiApiError on fetch failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      await expect(fetchAudioDevices()).rejects.toThrow(UiApiError);
    });
  });

  describe('playDeviceSource', () => {
    it('should play stream source', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ source: 'stream' }),
      });

      const result = await playDeviceSource('pi-audio-01', 'stream');

      expect(result).toEqual({ source: 'stream' });
      expect(global.fetch).toHaveBeenCalledWith(
        '/ui/audio/devices/pi-audio-01/play',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ source: 'stream' }),
        })
      );
    });

    it('should throw UiApiError with custom message for offline device', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        text: async () => 'upstream_unreachable',
      });

      await expect(playDeviceSource('pi-audio-01', 'stream')).rejects.toThrow(
        'Device offline or unreachable'
      );
    });
  });

  describe('stopDevice', () => {
    it('should stop device playback', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
      });

      await stopDevice('pi-audio-01');

      expect(global.fetch).toHaveBeenCalledWith(
        '/ui/audio/devices/pi-audio-01/stop',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('setDeviceVolume', () => {
    it('should set device volume', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
      });

      await setDeviceVolume('pi-audio-01', 1.5);

      expect(global.fetch).toHaveBeenCalledWith(
        '/ui/audio/devices/pi-audio-01/volume',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ volumePercent: 75 }), // 1.5 * 50 = 75%
        })
      );
    });
  });

  describe('uploadDeviceFallback', () => {
    it('should upload fallback file', async () => {
      const mockFile = new File(['audio content'], 'fallback.mp3', { type: 'audio/mpeg' });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ saved: true, path: '/data/fallback.mp3', fallbackExists: true }),
      });

      const result = await uploadDeviceFallback('pi-audio-01', mockFile);

      expect(result).toEqual({ saved: true, path: '/data/fallback.mp3', fallbackExists: true });
      expect(global.fetch).toHaveBeenCalledWith(
        '/ui/audio/devices/pi-audio-01/upload',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should reject files larger than 50 MB', async () => {
      const largeFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.mp3', {
        type: 'audio/mpeg',
      });

      await expect(uploadDeviceFallback('pi-audio-01', largeFile)).rejects.toThrow(
        'File too large. Maximum size is 50 MB.'
      );
    });
  });
});
