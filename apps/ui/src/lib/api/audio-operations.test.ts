import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AudioState as ApiAudioState } from '$lib/api/client';
type AudioApiMockMap = Record<
  | 'getOverview'
  | 'getDevice'
  | 'uploadAudioTrack'
  | 'createPlaylist'
  | 'updatePlaylist'
  | 'deletePlaylist'
  | 'startPlayback'
  | 'pauseDevice'
  | 'resumeDevice'
  | 'stopDevice'
  | 'seekDevice'
  | 'setDeviceVolume'
  | 'setMasterVolume',
  ReturnType<typeof vi.fn>
>;

const audioApiMocks = vi.hoisted(() => ({
  getOverview: vi.fn(),
  getDevice: vi.fn(),
  uploadAudioTrack: vi.fn(),
  createPlaylist: vi.fn(),
  updatePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  startPlayback: vi.fn(),
  pauseDevice: vi.fn(),
  resumeDevice: vi.fn(),
  stopDevice: vi.fn(),
  seekDevice: vi.fn(),
  setDeviceVolume: vi.fn(),
  setMasterVolume: vi.fn(),
})) as AudioApiMockMap;

vi.mock('$lib/api/mock', () => ({
  mockApi: {
    audio: vi.fn(),
    audioPlay: vi.fn(),
    audioPause: vi.fn(),
    audioResume: vi.fn(),
    audioStop: vi.fn(),
    audioSeek: vi.fn(),
    audioSetVolume: vi.fn(),
    audioSetMasterVolume: vi.fn(),
    audioCreatePlaylist: vi.fn(),
    audioUpdatePlaylist: vi.fn(),
    audioDeletePlaylist: vi.fn(),
    audioUpload: vi.fn(),
  },
}));

vi.mock('$lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('$lib/api/client')>('$lib/api/client');
  return {
    ...actual,
    USE_MOCKS: false,
    AudioApi: audioApiMocks,
  };
});

describe('audio-operations (D1 integration)', () => {
  beforeEach(() => {
    for (const mock of Object.values(audioApiMocks)) {
      mock.mockReset();
    }
  });

  test('normalises audio overview payload', async () => {
    const overview: ApiAudioState = {
      masterVolume: 82,
      devices: [
        {
          id: 'pi-audio-01',
          name: 'Pi Audio 01',
          status: 'online',
          group: null,
          volumePercent: 120,
          capabilities: ['sync:ptp'],
          playback: {
            state: 'playing',
            trackId: null,
            trackTitle: null,
            playlistId: 'playlist-main',
            positionSeconds: 64,
            durationSeconds: 180,
            startedAt: '2024-01-01T00:00:00Z',
            syncGroup: 'sync-a',
            lastError: null,
          },
          lastUpdated: '2024-01-01T00:00:00Z',
        },
      ],
      library: [
        {
          id: 'track-01',
          title: 'Ambient Loop',
          artist: null,
          durationSeconds: 180,
          format: 'mp3',
          tags: undefined,
          uploadedAt: '2024-01-01T00:00:00Z',
        },
      ],
      playlists: [
        {
          id: 'playlist-main',
          name: 'Main Lobby',
          description: null,
          loop: true,
          syncMode: 'synced',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          tracks: [
            {
              trackId: 'track-01',
              order: 1,
              startOffsetSeconds: null,
              deviceOverrides: null,
            },
          ],
        },
      ],
      sessions: [
        {
          id: 'session-01',
          playlistId: null,
          deviceIds: ['pi-audio-01'],
          syncMode: 'synced',
          state: 'playing',
          startedAt: '2024-01-01T00:05:00Z',
        },
      ],
      message: null,
    };

    audioApiMocks.getOverview.mockResolvedValue(overview);

    const { getAudioOverview } = await import('./audio-operations');
    const state = await getAudioOverview();

    expect(audioApiMocks.getOverview).toHaveBeenCalledTimes(1);
    expect(state.masterVolume).toBe(82);
    expect(state.devices[0].playback.trackId).toBeNull();
    expect(state.playlists[0].tracks[0].startOffsetSeconds).toBeUndefined();
    expect(state.library[0].tags).toEqual([]);
  });

  test('orchestrates playback via D1 payload', async () => {
    const overview: ApiAudioState = {
      masterVolume: 90,
      devices: [],
      library: [],
      playlists: [],
      sessions: [],
      message: null,
    };

    audioApiMocks.startPlayback.mockResolvedValue(undefined);
    audioApiMocks.getOverview.mockResolvedValue(overview);

    const { playOnDevices } = await import('./audio-operations');
    const result = await playOnDevices({
      deviceIds: ['pi-audio-01', 'pi-audio-02'],
      trackId: 'track-01',
      assignments: [
        { deviceId: 'pi-audio-01', trackId: 'track-01' },
        { deviceId: 'pi-audio-02', trackId: '' },
      ],
      syncMode: 'independent',
      resume: true,
      startAtSeconds: 30,
      loop: false,
    });

    expect(audioApiMocks.startPlayback).toHaveBeenCalledTimes(1);
    expect(audioApiMocks.startPlayback).toHaveBeenCalledWith({
      deviceIds: ['pi-audio-01', 'pi-audio-02'],
      playlistId: null,
      trackId: 'track-01',
      assignments: [
        {
          deviceId: 'pi-audio-01',
          trackId: 'track-01',
          startOffsetSeconds: null,
        },
      ],
      syncMode: 'independent',
      resume: true,
      startAtSeconds: 30,
      loop: false,
    });

    expect(audioApiMocks.getOverview).toHaveBeenCalledTimes(1);
    expect(result.masterVolume).toBe(90);
  });

  test('surface friendly seek error messaging', async () => {
    const { ApiError } = await vi.importActual<typeof import('$lib/api/client')>('$lib/api/client');
    const request = { method: 'POST', url: '/audio/devices/pi-audio-01/seek' } as Record<string, unknown>;
    const response = {
      url: '/audio/devices/pi-audio-01/seek',
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      body: { message: 'Position outside current track duration' },
    } as any;
    const apiError = new ApiError(request, response, 'Unprocessable Entity');

    audioApiMocks.seekDevice.mockRejectedValue(apiError);

    const { seekDevice } = await import('./audio-operations');

    await expect(seekDevice('pi-audio-01', 999)).rejects.toMatchObject({
      message: 'Seek request rejected by device. Check target position and retry.',
      status: 422,
    });
    expect(audioApiMocks.getDevice).not.toHaveBeenCalled();
  });
});
