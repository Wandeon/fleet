import supertest from 'supertest';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

const deviceMock = { findMany: vi.fn() };
const deviceStateMock = { findFirst: vi.fn(), findMany: vi.fn() };
const deviceEventMock = { findMany: vi.fn() };
const jobMock = { findUnique: vi.fn() };

vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    device: deviceMock,
    deviceState: deviceStateMock,
    deviceEvent: deviceEventMock,
    job: jobMock,
  },
}));

describe('Prisma TEXT serialization', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed objects from text-backed Prisma columns', async () => {
    deviceMock.findMany.mockResolvedValueOnce([
      {
        id: 'device-1',
        name: 'Device One',
        kind: 'sensor',
        address: JSON.stringify({ baseUrl: 'http://device-1.local', token: 'abc' }),
        capabilities: JSON.stringify({
          operations: [{ id: 'restart', method: 'POST', path: '/restart' }],
        }),
        managed: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      } as any,
    ]);

    deviceStateMock.findFirst.mockResolvedValueOnce({
      id: 'state-1',
      deviceId: 'device-1',
      status: 'online',
      lastSeen: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      state: JSON.stringify({ uptimeSeconds: 42 }),
    } as any);

    deviceEventMock.findMany.mockResolvedValueOnce([
      {
        id: 'event-1',
        deviceId: 'device-1',
        eventType: 'test.event',
        payload: JSON.stringify({ ok: true }),
        origin: 'test',
        at: new Date('2024-01-02T00:00:00.000Z'),
        correlationId: null,
      } as any,
    ]);

    jobMock.findUnique.mockResolvedValueOnce({
      id: 'job-1',
      deviceId: 'device-1',
      command: 'tv.input',
      payload: JSON.stringify({ source: 'hdmi1' }),
      status: 'pending',
      error: null,
      createdAt: new Date('2024-01-02T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    } as any);

    deviceStateMock.findMany.mockResolvedValueOnce([
      {
        id: 'state-1',
        deviceId: 'device-1',
        status: 'online',
        lastSeen: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        state: JSON.stringify({ uptimeSeconds: 42 }),
      } as any,
    ]);

    deviceEventMock.findMany.mockResolvedValueOnce([
      {
        id: 'event-2',
        deviceId: 'device-1',
        eventType: 'test.event',
        payload: JSON.stringify({ ok: true }),
        origin: 'test',
        at: new Date('2024-01-02T00:00:00.000Z'),
        correlationId: null,
      } as any,
    ]);

    const app = express();
    app.use(express.json());
    const { router } = await import('../../src/http/routes.js');
    app.use(router);

    const devicesResponse = await supertest(app)
      .get('/devices')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(devicesResponse.body.devices[0].address.baseUrl).toBe('http://device-1.local');
    expect(devicesResponse.body.devices[0].capabilities.operations[0].id).toBe('restart');

    const stateResponse = await supertest(app)
      .get('/devices/device-1/state')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(stateResponse.body.state.state.uptimeSeconds).toBe(42);

    const eventsResponse = await supertest(app)
      .get('/device_events?device_id=device-1')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(eventsResponse.body.events[0].payload.ok).toBe(true);

    const jobResponse = await supertest(app)
      .get('/jobs/job-1')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(jobResponse.body.job.payload.source).toBe('hdmi1');
  });
});
