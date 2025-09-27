import supertest from 'supertest';
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { beforeEach, describe, expect, it, afterAll, beforeAll, afterEach } from 'vitest';
import { createApp } from '../../src/index.js';
import { prisma } from '../../src/lib/db.js';
import { setRegistryForTests } from '../../src/upstream/devices.js';

async function resetAudioTables() {
  await prisma.$transaction([
    prisma.audioPlaylistTrack.deleteMany(),
    prisma.audioPlaylist.deleteMany(),
    prisma.audioSession.deleteMany(),
    prisma.audioDeviceStatus.deleteMany(),
    prisma.audioTrack.deleteMany(),
    prisma.audioSetting.deleteMany(),
  ]);
}

describe('Audio API endpoints', () => {
  const deviceOrigin = 'http://audio-device.test';
  const mockAgent = new MockAgent();
  const originalDispatcher = getGlobalDispatcher();
  const mockPool = mockAgent.get(deviceOrigin);

  beforeAll(() => {
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  beforeEach(async () => {
    await resetAudioTables();
  });

  afterEach(() => {
    mockAgent.assertNoPendingInterceptors();
  });

  afterAll(async () => {
    await resetAudioTables();
    await prisma.$disconnect();
    setGlobalDispatcher(originalDispatcher);
    await mockAgent.close();
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
        tracks: [{ trackId, order: 0 }],
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

  describe('POST /audio/devices/:deviceId/upload', () => {
    it('uploads fallback audio and records audit log entries', async () => {
      setRegistryForTests({
        devices: [
          {
            id: 'pi-audio-upload',
            name: 'Upload Device',
            role: 'audio',
            module: 'audio',
            baseUrl: `${deviceOrigin}/`,
            token: 'device-token',
            capabilities: ['upload', 'status'],
          },
        ],
      });

      mockPool
        .intercept({ path: '/upload', method: 'POST' })
        .reply(200, { saved: true, path: '/data/fallback.mp3' });
      mockPool
        .intercept({ path: '/status', method: 'GET' })
        .reply(200, {
          stream_url: '',
          volume: 1,
          mode: 'auto',
          source: 'file',
          fallback_exists: true,
        });

      const app = createApp();
      const response = await supertest(app)
        .post('/audio/devices/pi-audio-upload/upload')
        .set('Authorization', 'Bearer test-token')
        .attach('file', Buffer.from('audio-bytes'), 'fallback.mp3')
        .expect(201);

      expect(response.body).toMatchObject({
        deviceId: 'pi-audio-upload',
        fallbackExists: true,
        saved: true,
        path: '/data/fallback.mp3',
      });

      const logs = await supertest(app)
        .get('/logs/query?limit=10')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      const logMessages = (logs.body.items ?? []).map((entry: any) => entry.message ?? entry.meta?.msg);
      expect(logMessages).toContain('audio.upload');
    });

    it('rejects files over 50 MB', async () => {
      setRegistryForTests({
        devices: [
          {
            id: 'pi-audio-upload',
            name: 'Upload Device',
            role: 'audio',
            module: 'audio',
            baseUrl: `${deviceOrigin}/`,
            token: 'device-token',
            capabilities: ['upload', 'status'],
          },
        ],
      });

      const oversized = Buffer.alloc(50 * 1024 * 1024 + 1);
      const app = createApp();
      const response = await supertest(app)
        .post('/audio/devices/pi-audio-upload/upload')
        .set('Authorization', 'Bearer test-token')
        .attach('file', oversized, 'big.mp3')
        .expect(400);

      expect(response.body.message).toBe('File too large. Maximum size is 50 MB.');
    });

    it('surfaces upstream connectivity failures', async () => {
      setRegistryForTests({
        devices: [
          {
            id: 'pi-audio-upload',
            name: 'Upload Device',
            role: 'audio',
            module: 'audio',
            baseUrl: `${deviceOrigin}/`,
            token: 'device-token',
            capabilities: ['upload', 'status'],
          },
        ],
      });

      mockPool
        .intercept({ path: '/upload', method: 'POST' })
        .replyWithError(new Error('connect ECONNREFUSED'));

      const app = createApp();
      const response = await supertest(app)
        .post('/audio/devices/pi-audio-upload/upload')
        .set('Authorization', 'Bearer test-token')
        .attach('file', Buffer.from('audio-bytes'), 'fallback.mp3')
        .expect(502);

      expect(response.body.code).toBe('upstream_unreachable');
    });
  });
});
