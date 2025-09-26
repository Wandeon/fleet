import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/index';

const AUTH_HEADER = { Authorization: 'Bearer test-token' };

describe('Settings routes', () => {
  const app = createApp();

  it('lists operators with metadata and supports invites/updates/removals', async () => {
    const list = await supertest(app).get('/settings/operators').set(AUTH_HEADER).expect(200);
    expect(list.body).toMatchObject({ items: expect.any(Array), total: expect.any(Number) });
    const initialTotal = list.body.total as number;

    const invite = await supertest(app)
      .post('/settings/operators')
      .set(AUTH_HEADER)
      .send({ email: 'new.operator@example.com', roles: ['automation', 'viewer'] })
      .expect(201);

    expect(invite.body).toMatchObject({
      email: 'new.operator@example.com',
      roles: ['automation', 'viewer'],
      status: 'pending'
    });

    const operatorId = invite.body.id as string;

    const updated = await supertest(app)
      .put(`/settings/operators/${operatorId}`)
      .set(AUTH_HEADER)
      .send({ status: 'active', roles: ['automation', 'security'] })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: operatorId,
      status: 'active',
      roles: ['automation', 'security']
    });

    const afterInvite = await supertest(app).get('/settings/operators').set(AUTH_HEADER).expect(200);
    expect(afterInvite.body.total).toBe(initialTotal + 1);

    await supertest(app).delete(`/settings/operators/${operatorId}`).set(AUTH_HEADER).expect(202);
  });

  it('retrieves and updates security settings', async () => {
    const current = await supertest(app).get('/settings/security').set(AUTH_HEADER).expect(200);
    expect(current.body).toHaveProperty('nightMode');
    expect(current.body.nightMode).toHaveProperty('alertChannels');

    const patched = await supertest(app)
      .patch('/settings/security')
      .set(AUTH_HEADER)
      .send({ nightMode: { escalationEnabled: false, alertChannels: ['email', 'sms'] } })
      .expect(200);

    expect(patched.body.nightMode).toMatchObject({ escalationEnabled: false, alertChannels: ['email', 'sms'] });
  });
});
