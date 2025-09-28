import supertest from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/index.js';
import { resetCameraEvents } from '../../src/services/cameraEvents.js';
import { setRegistryForTests } from '../../src/upstream/devices.js';

describe('Camera events endpoints (offline readiness)', () => {
  beforeEach(() => {
    setRegistryForTests({
      devices: [
        {
          id: 'cam-lobby',
          name: 'Lobby Camera',
          role: 'camera-node',
          module: 'camera',
          baseUrl: 'http://127.0.0.1:3102',
        },
      ],
    });
    resetCameraEvents();
  });

  it('returns offline camera events payload with empty results', async () => {
    const app = createApp();
    const response = await supertest(app)
      .get('/api/camera/events?limit=1')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body.status).toBe('offline');
    expect(response.body.events).toHaveLength(0);
    expect(response.body.pagination).toMatchObject({ limit: 1, total: 0, hasMore: false });
    expect(response.body.reason).toContain('Camera hardware not attached');
  });

  it('rejects acknowledgements when no events exist', async () => {
    const app = createApp();
    const response = await supertest(app)
      .post('/api/camera/events/nonexistent/ack')
      .set('Authorization', 'Bearer test-token')
      .expect(422);

    expect(response.body.code).toBe('validation_failed');
  });

  it('exposes offline preview status for known cameras', async () => {
    const app = createApp();
    const preview = await supertest(app)
      .get('/api/camera/preview/cam-lobby')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(preview.body.status).toBe('unavailable');
    expect(preview.body.reason).toContain('Camera hardware not attached');
  });
});
