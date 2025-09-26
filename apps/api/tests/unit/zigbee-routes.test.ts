import supertest from 'supertest';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, beforeEach, afterEach, it } from 'vitest';
import { createApp } from '../../src/index';
import { __clearZigbeeRuleCacheForTests } from '../../src/services/zigbeeRules';

const AUTH_HEADER = { Authorization: 'Bearer test-token' };
const storePath = resolve(process.env.ZIGBEE_RULES_PATH ?? 'apps/api/tests/tmp/zigbee-rules.json');

async function resetRuleStore() {
  __clearZigbeeRuleCacheForTests();
  try {
    await fs.rm(storePath);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

describe('Zigbee automation rules routes', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetRuleStore();
  });

  afterEach(async () => {
    await resetRuleStore();
  });

  it('lists rules from fallback fixture', async () => {
    const response = await supertest(app).get('/zigbee/rules').set(AUTH_HEADER).expect(200);

    expect(response.body).toHaveProperty('items');
    expect(response.body.items.length).toBeGreaterThan(0);
    const sample = response.body.items[0];
    expect(sample).toHaveProperty('id');
    expect(sample).toHaveProperty('trigger');
  });

  it('creates, updates, toggles, and deletes a rule', async () => {
    const createPayload = {
      name: 'Test motion automation',
      trigger: {
        type: 'sensor_event',
        sensorId: 'zig-test-motion-01',
        event: 'motion',
        condition: {
          field: 'confidence',
          operator: 'gte',
          value: 0.5,
        },
      },
      actions: [
        {
          type: 'device_command',
          deviceId: 'zig-test-light-01',
          command: 'turn_on',
          payload: { brightness: 75 },
        },
      ],
      tags: ['lab', 'lighting'],
    };

    const created = await supertest(app)
      .post('/zigbee/rules')
      .set(AUTH_HEADER)
      .send(createPayload)
      .expect(201);

    expect(created.body).toMatchObject({
      name: 'Test motion automation',
      enabled: true,
    });

    const ruleId = created.body.id as string;

    const updated = await supertest(app)
      .put(`/zigbee/rules/${ruleId}`)
      .set(AUTH_HEADER)
      .send({
        name: 'Updated motion automation',
        enabled: false,
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: ruleId,
      name: 'Updated motion automation',
      enabled: false,
    });

    const toggled = await supertest(app)
      .patch(`/zigbee/rules/${ruleId}/enable`)
      .set(AUTH_HEADER)
      .send({ enabled: true })
      .expect(200);

    expect(toggled.body.enabled).toBe(true);

    await supertest(app).delete(`/zigbee/rules/${ruleId}`).set(AUTH_HEADER).expect(204);

    await supertest(app).get(`/zigbee/rules/${ruleId}`).set(AUTH_HEADER).expect(404);
  });

  it('simulates a rule definition and returns evaluation metadata', async () => {
    const simulation = await supertest(app)
      .post('/zigbee/rules/simulate')
      .set(AUTH_HEADER)
      .send({
        definition: {
          name: 'Simulated night escalation',
          trigger: {
            type: 'expression',
            expression: "context.mode === 'night' && context.event.type === 'open'",
          },
          actions: [
            { type: 'delay', durationSeconds: 5 },
            { type: 'notify', channel: 'slack', message: 'Night door opened' },
          ],
        },
        input: {
          context: { mode: 'night' },
          event: { type: 'open' },
        },
      })
      .expect(200);

    expect(simulation.body).toMatchObject({
      matched: true,
      actions: expect.any(Array),
      evaluation: expect.objectContaining({ triggerType: 'expression' }),
    });
  });
});
