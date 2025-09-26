import supertest from 'supertest';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/index.js';
import { resetCameraEvents, setCameraEventsForTests } from '../../src/services/cameraEvents.js';
import { setRegistryForTests } from '../../src/upstream/devices.js';

describe('Camera events endpoints', () => {
  beforeEach(() => {
    setRegistryForTests({
      devices: [
        {
          id: 'cam-lobby',
          name: 'Lobby Camera',
          role: 'camera',
          baseUrl: 'http://127.0.0.1:3102',
        },
        {
          id: 'cam-dock',
          name: 'Dock Camera',
          role: 'camera',
          baseUrl: 'http://127.0.0.1:3103',
        },
      ],
    });
    setCameraEventsForTests([
      {
        id: 'evt-lobby-1',
        cameraId: 'cam-lobby',
        type: 'motion',
        severity: 'info',
        timestamp: '2024-03-20T08:00:00Z',
        synopsis: 'Person detected near reception desk',
        tags: ['lobby'],
        confidence: 0.42,
      },
      {
        id: 'evt-dock-1',
        cameraId: 'cam-dock',
        type: 'intrusion',
        severity: 'critical',
        timestamp: '2024-03-20T08:05:00Z',
        synopsis: 'Unauthorized entry at dock door',
        tags: ['dock', 'intrusion'],
        confidence: 0.93,
      },
    ]);
  });

  afterEach(() => {
    resetCameraEvents();
  });

  it('returns camera events with pagination data', async () => {
    const app = createApp();
    const response = await supertest(app)
      .get('/camera/events?limit=1')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body.events).toHaveLength(1);
    expect(response.body.pagination).toMatchObject({ limit: 1, total: 2 });
    expect(response.body.filters.tags).toEqual([]);
  });

  it('returns event detail with metadata and clip reference', async () => {
    const app = createApp();
    const list = await supertest(app)
      .get('/camera/events')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    const eventId = list.body.events[0].id as string;
    const detail = await supertest(app)
      .get(`/camera/events/${eventId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(detail.body.event.id).toBe(eventId);
    expect(detail.body.event.metadata).toBeTypeOf('object');
    expect(detail.body.event.clip).toHaveProperty('url');
  });
});
