import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const _env = vi.hoisted(() => {
  process.env.API_BEARER = 'test-token';
  process.env.DEVICE_REGISTRY_JSON = JSON.stringify({ devices: [] });
  return {};
});

import { createApp } from '../../index.js';
import { setRegistryForTests } from '../../upstream/devices.js';

const AUTH_HEADER = { Authorization: 'Bearer test-token' } as const;

describe('camera routes (offline readiness)', () => {
  const app = createApp();

  beforeAll(() => {
    setRegistryForTests({
      devices: [
        {
          id: 'pi-camera-01',
          name: 'Camera Node',
          role: 'camera-node',
          module: 'camera',
          baseUrl: 'http://pi-camera-01:8083',
          capabilities: ['streaming'],
        },
      ],
    });
  });

  it('returns offline summary with camera placeholder', async () => {
    const response = await request(app).get('/api/camera/summary').set(AUTH_HEADER);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('offline');
    expect(Array.isArray(response.body.devices)).toBe(true);
  });

  it('returns offline events feed', async () => {
    const response = await request(app).get('/api/camera/events').set(AUTH_HEADER);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('offline');
    expect(Array.isArray(response.body.events)).toBe(true);
  });

  it('rejects acknowledgement for unknown events', async () => {
    const response = await request(app)
      .post('/api/camera/events/missing-event/ack')
      .set(AUTH_HEADER);
    expect(response.status).toBe(422);
    expect(response.body.code).toBe('validation_failed');
  });

  it('returns offline preview for registered camera', async () => {
    const response = await request(app).get('/api/camera/preview/pi-camera-01').set(AUTH_HEADER);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('unavailable');
    expect(response.body.reason).toContain('Camera hardware not attached');
  });

  it('returns not found for unknown camera preview', async () => {
    const response = await request(app).get('/api/camera/preview/unknown').set(AUTH_HEADER);
    expect(response.status).toBe(404);
  });
});
