import supertest from 'supertest';
import { beforeEach, describe, expect, it, afterAll } from 'vitest';
import { createApp } from '../../src/index.js';
import { prisma } from '../../src/lib/db.js';

async function resetAudioTables() {
  await prisma.$transaction([
    prisma.audioPlaylistTrack.deleteMany(),
    prisma.audioPlaylist.deleteMany(),
    prisma.audioSession.deleteMany(),
    prisma.audioDeviceStatus.deleteMany(),
    prisma.audioTrack.deleteMany(),
    prisma.audioSetting.deleteMany()
  ]);
}

describe('Audio API endpoints', () => {
  beforeEach(async () => {
    await resetAudioTables();
  });

  afterAll(async () => {
    await resetAudioTables();
    await prisma.$disconnect();
  });

  it('returns overview data with defaults', async () => {
    const app = createApp();
    const response = await supertest(app)
      .get('/audio/overview')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body.masterVolume).toBe(50);
    expect(response.body.devices).toEqual([]);
    expect(response.body.library).toEqual([]);
    expect(response.body.playlists).toEqual([]);
    expect(response.body.sessions).toEqual([]);
  });

  it('supports uploading tracks, playlists, and playback controls', async () => {
    const app = createApp();

    const uploadResponse = await supertest(app)
      .post('/audio/library')
      .set('Authorization', 'Bearer test-token')
      .attach('file', Buffer.from('test-audio'), 'test.mp3')
      .field('title', 'Ambient Track')
      .field('artist', 'Test Artist')
      .field('durationSeconds', '120')
      .expect(201);

    const trackId = uploadResponse.body.id as string;

    const playlistResponse = await supertest(app)
      .post('/audio/playlists')
      .set('Authorization', 'Bearer test-token')
      .send({
        name: 'Morning Playlist',
        loop: false,
        syncMode: 'synced',
        tracks: [{ trackId, order: 0 }]
      })
      .expect(201);

    const playlistId = playlistResponse.body.id as string;

    await supertest(app)
      .post('/audio/playback')
      .set('Authorization', 'Bearer test-token')
      .send({ deviceIds: ['pi-audio-test'], playlistId, syncMode: 'synced' })
      .expect(202);

    const deviceResponse = await supertest(app)
      .get('/audio/devices/pi-audio-test')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(deviceResponse.body.playback.state).toBe('playing');
    expect(deviceResponse.body.playback.playlistId).toBe(playlistId);

    await supertest(app)
      .post('/audio/devices/pi-audio-test/pause')
      .set('Authorization', 'Bearer test-token')
      .expect(202);

    const paused = await supertest(app)
      .get('/audio/devices/pi-audio-test')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(paused.body.playback.state).toBe('paused');

    await supertest(app)
      .post('/audio/devices/pi-audio-test/seek')
      .set('Authorization', 'Bearer test-token')
      .send({ positionSeconds: 45 })
      .expect(202);

    await supertest(app)
      .post('/audio/devices/pi-audio-test/volume')
      .set('Authorization', 'Bearer test-token')
      .send({ volumePercent: 35 })
      .expect(202);

    await supertest(app)
      .post('/audio/master-volume')
      .set('Authorization', 'Bearer test-token')
      .send({ volumePercent: 60 })
      .expect(202);

    const overview = await supertest(app)
      .get('/audio/overview')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(overview.body.masterVolume).toBe(60);
    expect(overview.body.sessions[0].deviceIds).toContain('pi-audio-test');
  });
});
