import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/index.js';

describe('Logs export endpoint', () => {
  it('rejects export requests without privileged roles', async () => {
    const app = createApp();
    const response = await supertest(app)
      .post('/logs/export')
      .set('Authorization', 'Bearer test-token')
      .send({ deviceId: 'cam-1' })
      .expect(403);

    expect(response.body.code).toBe('forbidden');
  });

  it('accepts export when privileged headers are provided', async () => {
    const app = createApp();
    const response = await supertest(app)
      .post('/logs/export')
      .set('Authorization', 'Bearer test-token')
      .set('x-operator-roles', 'admin')
      .send({
        deviceId: 'cam-1',
        level: 'error',
        start: '2024-03-01T00:00:00Z',
        end: '2024-03-02T00:00:00Z',
        format: 'csv',
      })
      .expect(202);

    expect(response.body.format).toBe('csv');
    expect(response.body.downloadUrl).toMatch(/\.csv$/);
    expect(response.body.filters.deviceId).toBe('cam-1');
  });
});
