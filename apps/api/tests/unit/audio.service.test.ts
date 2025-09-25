import { beforeEach, describe, expect, it, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import {
  createLibraryTrack,
  listLibraryTracks,
  startPlayback,
  getDeviceSnapshot,
  setMasterVolume,
  getMasterVolume
} from '../../src/services/audio.js';

async function reset() {
  await prisma.$transaction([
    prisma.audioPlaylistTrack.deleteMany(),
    prisma.audioPlaylist.deleteMany(),
    prisma.audioSession.deleteMany(),
    prisma.audioDeviceStatus.deleteMany(),
    prisma.audioTrack.deleteMany(),
    prisma.audioSetting.deleteMany()
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
      tags: ['ambient']
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
      filename: 'loop.mp3'
    });

    await startPlayback({
      deviceIds: ['pi-audio-test'],
      trackId: track.id,
      syncMode: 'independent'
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
});
