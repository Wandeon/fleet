import express from 'express';
import type { AddressInfo } from 'node:net';
import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/index';
import { setRegistryForTests } from '../../src/upstream/devices';
import { resetCircuitBreakers } from '../../src/upstream/http';
import { resetMetricsForTest } from '../../src/observability/metrics';
import { resetEvents } from '../../src/observability/events';

interface MockOptions {
  statusDelayMs?: number;
  conflictOnPlay?: boolean;
  hangStatus?: boolean;
}

function startMockAudioServer(options: MockOptions = {}) {
  const app = express();
  app.use(express.json());

  const state = {
    stream_url: 'http://stream.example/test.mp3',
    volume: 1,
    mode: 'auto' as const,
    source: 'stream' as const,
    fallback_exists: false
  };

  app.use((req, res, next) => {
    if (req.path === '/healthz') {
      return res.send('ok');
    }
    if (req.headers.authorization !== 'Bearer device-token') {
      return res.status(401).send('missing token');
    }
    return next();
  });

  app.get('/status', (_req, res) => {
    if (options.hangStatus) {
      return;
    }
    const send = () => res.json(state);
    if (options.statusDelayMs) {
      setTimeout(send, options.statusDelayMs);
    } else {
      send();
    }
  });

  app.get('/config', (_req, res) => {
    res.json(state);
  });

  app.put('/config', (req, res) => {
    Object.assign(state, req.body);
    res.json(state);
  });

  app.post('/volume', (req, res) => {
    state.volume = req.body.volume;
    res.json(state);
  });

  app.post('/play', (req, res) => {
    if (options.conflictOnPlay) {
      return res.status(409).send('busy');
    }
    state.source = req.body.source;
    res.json(state);
  });

  app.post('/stop', (_req, res) => {
    state.source = 'stop';
    res.json(state);
  });

  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((closeResolve) => {
            server.close(() => closeResolve());
          })
      });
    });
  });
}

describe('Audio proxy integration', () => {
  beforeEach(() => {
    resetMetricsForTest();
    resetEvents();
    resetCircuitBreakers();
  });

  afterEach(() => {
    setRegistryForTests({
      devices: [
        {
          id: 'pi-audio-test',
          name: 'Test Audio Device',
          role: 'audio',
          baseUrl: 'http://127.0.0.1:0'
        }
      ]
    });
  });

  it('forwards status requests to upstream device', async () => {
    const mock = await startMockAudioServer();
    setRegistryForTests({
      devices: [
        {
          id: 'pi-audio-test',
          name: 'Test Audio Device',
          role: 'audio',
          baseUrl: mock.url,
          token: 'device-token'
        }
      ]
    });

    const app = createApp();
    const response = await supertest(app)
      .get('/audio/pi-audio-test/status')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body.status.stream_url).toContain('stream.example');
    await mock.close();
  });

  it('requires bearer token', async () => {
    const mock = await startMockAudioServer();
    setRegistryForTests({
      devices: [
        {
          id: 'pi-audio-test',
          name: 'Test Audio Device',
          role: 'audio',
          baseUrl: mock.url,
          token: 'device-token'
        }
      ]
    });

    const app = createApp();
    await supertest(app).get('/audio/pi-audio-test/status').expect(401);
    await mock.close();
  });

  it('maps upstream conflict to 409', async () => {
    const mock = await startMockAudioServer({ conflictOnPlay: true });
    setRegistryForTests({
      devices: [
        {
          id: 'pi-audio-test',
          name: 'Test Audio Device',
          role: 'audio',
          baseUrl: mock.url,
          token: 'device-token'
        }
      ]
    });

    const app = createApp();
    const response = await supertest(app)
      .post('/audio/pi-audio-test/play')
      .set('Authorization', 'Bearer test-token')
      .send({ source: 'stream' })
      .expect(409);

    expect(response.body.code).toBe('conflict');
    await mock.close();
  });

  it('returns 502 when upstream is unreachable', async () => {
    setRegistryForTests({
      devices: [
        {
          id: 'pi-audio-test',
          name: 'Test Audio Device',
          role: 'audio',
          baseUrl: 'http://127.0.0.1:65535',
          token: 'device-token'
        }
      ]
    });

    const app = createApp();
    const response = await supertest(app)
      .get('/audio/pi-audio-test/status')
      .set('Authorization', 'Bearer test-token')
      .expect(502);

    expect(response.body.code).toBe('upstream_unreachable');
  });

  it('returns 504 on upstream timeout', async () => {
    const mock = await startMockAudioServer({ statusDelayMs: 500 });
    setRegistryForTests({
      devices: [
        {
          id: 'pi-audio-test',
          name: 'Test Audio Device',
          role: 'audio',
          baseUrl: mock.url,
          token: 'device-token'
        }
      ]
    });

    const app = createApp();
    const response = await supertest(app)
      .get('/audio/pi-audio-test/status')
      .set('Authorization', 'Bearer test-token')
      .expect(504);

    expect(response.body.code).toBe('upstream_timeout');
    await mock.close();
  });

  it('rejects invalid payloads with 422', async () => {
    const mock = await startMockAudioServer();
    setRegistryForTests({
      devices: [
        {
          id: 'pi-audio-test',
          name: 'Test Audio Device',
          role: 'audio',
          baseUrl: mock.url,
          token: 'device-token'
        }
      ]
    });

    const app = createApp();
    await supertest(app)
      .post('/audio/pi-audio-test/volume')
      .set('Authorization', 'Bearer test-token')
      .send({ volume: 9 })
      .expect(422);

    await mock.close();
  });
});
