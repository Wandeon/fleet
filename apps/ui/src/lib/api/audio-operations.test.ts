import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AudioState as ApiAudioState } from '$lib/api/client';
import type { ApiRequestOptions } from '$lib/api/gen/core/ApiRequestOptions';
import type { ApiResult } from '$lib/api/gen/core/ApiResult';
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
    expect(audioApiMocks.startPlayback).toHaveBeenCalledWith(
      expect.objectContaining({
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
      })
    );

    expect(audioApiMocks.getOverview).toHaveBeenCalledTimes(1);
    expect(result.masterVolume).toBe(90);
  });

  test('surface friendly seek error messaging', async () => {
    const { ApiError } = await vi.importActual<typeof import('$lib/api/client')>('$lib/api/client');
    const request = { method: 'POST', url: '/audio/devices/pi-audio-01/seek' } as ApiRequestOptions;
    const response: ApiResult = {
      url: '/audio/devices/pi-audio-01/seek',
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      body: { message: 'Position outside current track duration' },
    };
    const apiError = new ApiError(request, response, 'Unprocessable Entity');

    audioApiMocks.seekDevice.mockRejectedValue(apiError);

    const { seekDevice } = await import('./audio-operations');

    await expect(seekDevice('pi-audio-01', 999)).rejects.toMatchObject({
      message: 'Seek request rejected by device. Check target position and retry.',
      status: 422,
    });
    expect(audioApiMocks.getDevice).not.toHaveBeenCalled();
  });

  test('uploads track to library', async () => {
    const mockTrack = {
      id: 'track-new',
      title: 'New Track',
      artist: 'Test Artist',
      durationSeconds: 240,
      format: 'mp3' as const,
      sizeBytes: 4000000,
      tags: ['test'],
      uploadedAt: '2024-01-01T00:00:00Z',
    };

    audioApiMocks.uploadAudioTrack.mockResolvedValue(mockTrack);

    const { uploadTrack } = await import('./audio-operations');
    const file = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });

    const result = await uploadTrack({
      file,
      title: 'New Track',
      artist: 'Test Artist',
      tags: ['test'],
      durationSeconds: 240,
    });

    expect(audioApiMocks.uploadAudioTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
        title: 'New Track',
        artist: 'Test Artist',
        tags: 'test',
        durationSeconds: 240,
      })
    );
    expect(result.id).toBe('track-new');
    expect(result.title).toBe('New Track');
  });

  test('pauses device', async () => {
    const deviceSnapshot = {
      id: 'pi-audio-01',
      name: 'Pi Audio 01',
      status: 'online' as const,
      group: null,
      volumePercent: 100,
      capabilities: [],
      playback: {
        state: 'paused' as const,
        trackId: 'track-01',
        trackTitle: 'Test Track',
        playlistId: null,
        positionSeconds: 30,
        durationSeconds: 180,
        startedAt: '2024-01-01T00:00:00Z',
        syncGroup: null,
        lastError: null,
      },
      lastUpdated: '2024-01-01T00:01:00Z',
    };

    audioApiMocks.pauseDevice.mockResolvedValue(undefined);
    audioApiMocks.getDevice.mockResolvedValue(deviceSnapshot);

    const { pauseDevice } = await import('./audio-operations');
    const result = await pauseDevice('pi-audio-01');

    expect(audioApiMocks.pauseDevice).toHaveBeenCalledWith('pi-audio-01');
    expect(audioApiMocks.getDevice).toHaveBeenCalledWith('pi-audio-01');
    expect(result.playback.state).toBe('paused');
  });

  test('resumes device', async () => {
    const deviceSnapshot = {
      id: 'pi-audio-01',
      name: 'Pi Audio 01',
      status: 'online' as const,
      group: null,
      volumePercent: 100,
      capabilities: [],
      playback: {
        state: 'playing' as const,
        trackId: 'track-01',
        trackTitle: 'Test Track',
        playlistId: null,
        positionSeconds: 30,
        durationSeconds: 180,
        startedAt: '2024-01-01T00:00:00Z',
        syncGroup: null,
        lastError: null,
      },
      lastUpdated: '2024-01-01T00:01:00Z',
    };

    audioApiMocks.resumeDevice.mockResolvedValue(undefined);
    audioApiMocks.getDevice.mockResolvedValue(deviceSnapshot);

    const { resumeDevice } = await import('./audio-operations');
    const result = await resumeDevice('pi-audio-01');

    expect(audioApiMocks.resumeDevice).toHaveBeenCalledWith('pi-audio-01');
    expect(audioApiMocks.getDevice).toHaveBeenCalledWith('pi-audio-01');
    expect(result.playback.state).toBe('playing');
  });

  test('stops device', async () => {
    const deviceSnapshot = {
      id: 'pi-audio-01',
      name: 'Pi Audio 01',
      status: 'online' as const,
      group: null,
      volumePercent: 100,
      capabilities: [],
      playback: {
        state: 'idle' as const,
        trackId: null,
        trackTitle: null,
        playlistId: null,
        positionSeconds: 0,
        durationSeconds: 0,
        startedAt: null,
        syncGroup: null,
        lastError: null,
      },
      lastUpdated: '2024-01-01T00:01:00Z',
    };

    audioApiMocks.stopDevice.mockResolvedValue(undefined);
    audioApiMocks.getDevice.mockResolvedValue(deviceSnapshot);

    const { stopDevice } = await import('./audio-operations');
    const result = await stopDevice('pi-audio-01');

    expect(audioApiMocks.stopDevice).toHaveBeenCalledWith('pi-audio-01');
    expect(audioApiMocks.getDevice).toHaveBeenCalledWith('pi-audio-01');
    expect(result.playback.state).toBe('idle');
  });

  test('sets device volume', async () => {
    const deviceSnapshot = {
      id: 'pi-audio-01',
      name: 'Pi Audio 01',
      status: 'online' as const,
      group: null,
      volumePercent: 150,
      capabilities: [],
      playback: {
        state: 'idle' as const,
        trackId: null,
        trackTitle: null,
        playlistId: null,
        positionSeconds: 0,
        durationSeconds: 0,
        startedAt: null,
        syncGroup: null,
        lastError: null,
      },
      lastUpdated: '2024-01-01T00:01:00Z',
    };

    audioApiMocks.setDeviceVolume.mockResolvedValue(undefined);
    audioApiMocks.getDevice.mockResolvedValue(deviceSnapshot);

    const { setDeviceVolume } = await import('./audio-operations');
    const result = await setDeviceVolume('pi-audio-01', 150);

    expect(audioApiMocks.setDeviceVolume).toHaveBeenCalledWith('pi-audio-01', {
      volume: 1.5,
    });
    expect(result.volumePercent).toBe(150);
  });

  test('seeks device to position', async () => {
    const deviceSnapshot = {
      id: 'pi-audio-01',
      name: 'Pi Audio 01',
      status: 'online' as const,
      group: null,
      volumePercent: 100,
      capabilities: [],
      playback: {
        state: 'playing' as const,
        trackId: 'track-01',
        trackTitle: 'Test Track',
        playlistId: null,
        positionSeconds: 60,
        durationSeconds: 180,
        startedAt: '2024-01-01T00:00:00Z',
        syncGroup: null,
        lastError: null,
      },
      lastUpdated: '2024-01-01T00:01:00Z',
    };

    audioApiMocks.seekDevice.mockResolvedValue(undefined);
    audioApiMocks.getDevice.mockResolvedValue(deviceSnapshot);

    const { seekDevice } = await import('./audio-operations');
    const result = await seekDevice('pi-audio-01', 60);

    expect(audioApiMocks.seekDevice).toHaveBeenCalledWith('pi-audio-01', {
      positionSeconds: 60,
    });
    expect(result.playback.positionSeconds).toBe(60);
  });

  test('sets master volume', async () => {
    const overview: ApiAudioState = {
      masterVolume: 150,
      devices: [],
      library: [],
      playlists: [],
      sessions: [],
      message: null,
    };

    audioApiMocks.setMasterVolume.mockResolvedValue(undefined);
    audioApiMocks.getOverview.mockResolvedValue(overview);

    const { setMasterVolume } = await import('./audio-operations');
    const result = await setMasterVolume(150);

    expect(audioApiMocks.setMasterVolume).toHaveBeenCalledWith({
      volumePercent: 150,
    });
    expect(result.masterVolume).toBe(150);
  });

  test('creates playlist', async () => {
    const mockPlaylist = {
      id: 'playlist-new',
      name: 'Test Playlist',
      description: 'Test Description',
      loop: true,
      syncMode: 'synced' as const,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      tracks: [
        {
          trackId: 'track-01',
          order: 1,
          startOffsetSeconds: null,
          deviceOverrides: null,
        },
      ],
    };

    audioApiMocks.createPlaylist.mockResolvedValue(mockPlaylist);

    const { createPlaylist } = await import('./audio-operations');
    const result = await createPlaylist({
      name: 'Test Playlist',
      description: 'Test Description',
      loop: true,
      syncMode: 'synced',
      tracks: [{ trackId: 'track-01', order: 1 }],
    });

    expect(audioApiMocks.createPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Playlist',
        description: 'Test Description',
        loop: true,
        syncMode: 'synced',
        tracks: [
          {
            trackId: 'track-01',
            order: 1,
            startOffsetSeconds: null,
            deviceOverrides: null,
          },
        ],
      })
    );
    expect(result.id).toBe('playlist-new');
  });

  test('updates playlist', async () => {
    const mockPlaylist = {
      id: 'playlist-01',
      name: 'Updated Playlist',
      description: 'Updated Description',
      loop: false,
      syncMode: 'grouped' as const,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      tracks: [],
    };

    audioApiMocks.updatePlaylist.mockResolvedValue(mockPlaylist);

    const { updatePlaylist } = await import('./audio-operations');
    const result = await updatePlaylist('playlist-01', {
      name: 'Updated Playlist',
      description: 'Updated Description',
      loop: false,
      syncMode: 'grouped',
      tracks: [],
    });

    expect(audioApiMocks.updatePlaylist).toHaveBeenCalledWith(
      'playlist-01',
      expect.objectContaining({
        id: 'playlist-01',
        name: 'Updated Playlist',
      })
    );
    expect(result.name).toBe('Updated Playlist');
  });

  test('deletes playlist', async () => {
    audioApiMocks.deletePlaylist.mockResolvedValue(undefined);

    const { deletePlaylist } = await import('./audio-operations');
    await deletePlaylist('playlist-01');

    expect(audioApiMocks.deletePlaylist).toHaveBeenCalledWith('playlist-01');
  });
});
