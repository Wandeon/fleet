import { beforeEach, describe, expect, it, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import {
  createLibraryTrack,
  listLibraryTracks,
  startPlayback,
  getDeviceSnapshot,
  setMasterVolume,
  getMasterVolume,
  createPlaylist,
  reorderPlaylistTracks,
  listPlaylists,
  createPlaybackSession,
  listSessions,
  registerLibraryUpload,
} from '../../src/services/audio.js';

async function reset() {
  await prisma.$transaction([
    prisma.audioPlaylistTrack.deleteMany(),
    prisma.audioPlaylist.deleteMany(),
    prisma.audioSession.deleteMany(),
    prisma.audioDeviceStatus.deleteMany(),
    prisma.audioTrack.deleteMany(),
    prisma.audioSetting.deleteMany(),
  ]);
}

describe('Audio services', () => {
  beforeEach(async () => {
    await reset();
  });

  afterAll(async () => {
    await reset();
    await prisma.$disconnect();
  });

  it('creates and lists library tracks', async () => {
    await createLibraryTrack({
      title: 'Test Track',
      durationSeconds: 30,
      format: 'audio/mp3',
      buffer: Buffer.from('audio-data'),
      filename: 'sample.mp3',
      tags: ['ambient'],
    });

    const tracks = await listLibraryTracks();
    expect(tracks).toHaveLength(1);
    expect(tracks[0].title).toBe('Test Track');
    expect(tracks[0].tags).toContain('ambient');
  });

  it('starts playback and updates device snapshot', async () => {
    const track = await createLibraryTrack({
      title: 'Loop',
      durationSeconds: 90,
      format: 'audio/mp3',
      buffer: Buffer.from('audio'),
      filename: 'loop.mp3',
    });

    await startPlayback({
      deviceIds: ['pi-audio-test'],
      trackId: track.id,
      syncMode: 'independent',
    });

    const snapshot = await getDeviceSnapshot('pi-audio-test');
    expect(snapshot.playback.state).toBe('playing');
    expect(snapshot.playback.trackId).toBe(track.id);
  });

  it('persists master volume updates', async () => {
    await setMasterVolume(72);
    const value = await getMasterVolume();
    expect(value).toBe(72);
  });

  it('reorders playlist tracks', async () => {
    const first = await createLibraryTrack({
      title: 'First',
      durationSeconds: 45,
      format: 'audio/mp3',
      buffer: Buffer.from('first'),
      filename: 'first.mp3',
    });
    const second = await createLibraryTrack({
      title: 'Second',
      durationSeconds: 30,
      format: 'audio/mp3',
      buffer: Buffer.from('second'),
      filename: 'second.mp3',
    });

    const playlist = await createPlaylist({
      name: 'Morning',
      loop: false,
      syncMode: 'synced',
      tracks: [
        { trackId: first.id, order: 0 },
        { trackId: second.id, order: 1 },
      ],
    });

    await reorderPlaylistTracks(playlist.id, {
      ordering: [
        { trackId: second.id, position: 0 },
        { trackId: first.id, position: 1 },
      ],
    });

    const playlists = await listPlaylists();
    expect(playlists[0].tracks[0].trackId).toBe(second.id);
    expect(playlists[0].tracks[1].trackId).toBe(first.id);
  });

  it('creates playback sessions and surfaces drift metadata', async () => {
    const track = await createLibraryTrack({
      title: 'Session Track',
      durationSeconds: 120,
      format: 'audio/mp3',
      buffer: Buffer.from('session'),
      filename: 'session.mp3',
    });

    const session = await createPlaybackSession({
      deviceIds: ['pi-sync-a', 'pi-sync-b'],
      trackId: track.id,
      syncMode: 'synced',
    });

    expect(session.deviceIds).toHaveLength(2);
    expect(session.drift).toBeDefined();

    const sessions = await listSessions();
    expect(sessions.some((item) => item.id === session.id)).toBe(true);
  });

  it('registers library upload metadata for pre-signed flows', () => {
    const registration = registerLibraryUpload({
      filename: 'ambient.flac',
      contentType: 'audio/flac',
      sizeBytes: 2048,
      title: 'Ambient Loop',
      tags: ['calm'],
    });

    expect(registration.uploadUrl).toContain('https://uploads.example/');
    expect(registration.tags).toContain('calm');
    expect(registration.expiresAt).toBeTruthy();
  });
});
