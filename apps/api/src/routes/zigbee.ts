import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { deviceRegistry } from '../upstream/devices';
import {
  createZigbeeRule,
  deleteZigbeeRule,
  getZigbeeRule,
  getZigbeeRuleSchemas,
  listZigbeeRules,
  simulateZigbeeRule,
  updateZigbeeRule,
  validateZigbeeRuleDefinition,
} from '../services/zigbeeRules';
import { createHttpError } from '../util/errors';

const router = Router();

type PairingDevice = {
  id: string;
  model: string;
  manufacturer: string;
  lastSeen: string;
  signal: number;
};

const pairingState: {
  active: boolean;
  startedAt: string | null;
  expiresAt: string | null;
  discovered: PairingDevice[];
  confirmed: string[];
} = {
  active: false,
  startedAt: null,
  expiresAt: null,
  discovered: [],
  confirmed: [],
};

const pairingStartSchema = z.object({
  durationSeconds: z.coerce.number().int().min(30).max(900).default(300),
  channel: z.coerce.number().int().min(11).max(26).optional(),
});

const actionSchema = z.object({
  deviceId: z.string(),
  command: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const { update: ruleUpdateSchema, simulation: ruleSimulationSchema } = getZigbeeRuleSchemas();

router.get('/overview', async (_req, res, next) => {
  res.locals.routePath = '/zigbee/overview';
  try {
    const devices = deviceRegistry
      .list()
      .filter((device) => device.module === 'zigbee' || device.role.includes('zigbee'))
      .map((device) => ({
        id: device.id,
        name: device.name,
        model: 'unknown',
        lastSeen: new Date().toISOString(),
        status: pairingState.confirmed.includes(device.id) ? 'paired' : 'unverified',
      }));

    const rules = (await listZigbeeRules()).map((rule) => ({
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }));

    res.json({
      hub: {
        id: 'zigbee-hub',
        status: pairingState.active ? 'pairing' : 'online',
        channel: 20,
        lastHeartbeatAt: new Date().toISOString(),
      },
      pairing: {
        active: pairingState.active,
        startedAt: pairingState.startedAt,
        expiresAt: pairingState.expiresAt,
        discovered: pairingState.discovered,
        confirmed: pairingState.confirmed,
      },
      devices,
      rules,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', (_req, res) => {
  res.locals.routePath = '/zigbee';
  const devices = deviceRegistry
    .list()
    .filter((device) => device.module === 'zigbee' || device.role.includes('zigbee'));
  res.json({
    message: 'Zigbee API endpoint',
    status: 'active',
    timestamp: new Date().toISOString(),
    total: devices.length,
    devices: devices.map((device) => ({
      id: device.id,
      name: device.name,
      status: pairingState.confirmed.includes(device.id) ? 'paired' : 'discovered',
    })),
  });
});

router.get('/devices/:id/status', (req, res) => {
  res.locals.routePath = '/zigbee/devices/:id/status';
  const { id } = req.params;
  const device = deviceRegistry.getDevice(id);

  if (!device || (device.module !== 'zigbee' && !device.role.includes('zigbee'))) {
    return res.status(404).json({
      error: 'Zigbee device not found',
      id,
    });
  }

  res.json({
    id: device.id,
    name: device.name,
    status: pairingState.confirmed.includes(device.id) ? 'paired' : 'pending',
    timestamp: new Date().toISOString(),
  });
});

router.get('/devices', (_req, res) => {
  res.locals.routePath = '/zigbee/devices';
  const devices = deviceRegistry
    .list()
    .filter((device) => device.module === 'zigbee' || device.role.includes('zigbee'))
    .map((device) => ({
      id: device.id,
      name: device.name,
      role: device.role,
      module: device.module,
      status: pairingState.confirmed.includes(device.id) ? 'paired' : 'pending',
    }));

  res.json({ devices, updatedAt: new Date().toISOString() });
});

router.post('/actions', (req, res, next) => {
  res.locals.routePath = '/zigbee/actions';
  try {
    const payload = actionSchema.parse(req.body);
    res.status(202).json({
      accepted: true,
      commandId: randomUUID(),
      deviceId: payload.deviceId,
      command: payload.command,
      receivedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/pairing', (req, res, next) => {
  res.locals.routePath = '/zigbee/pairing';
  try {
    const payload = pairingStartSchema.parse(req.body ?? {});
    const now = new Date();
    pairingState.active = true;
    pairingState.startedAt = now.toISOString();
    pairingState.expiresAt = new Date(now.getTime() + payload.durationSeconds * 1000).toISOString();
    pairingState.discovered = [
      {
        id: `candidate-${randomUUID().slice(0, 8)}`,
        model: 'SmartBulb-X',
        manufacturer: 'Fleet Lighting',
        lastSeen: now.toISOString(),
        signal: -52,
      },
    ];
    res.json({
      active: pairingState.active,
      startedAt: pairingState.startedAt,
      expiresAt: pairingState.expiresAt,
      discovered: pairingState.discovered,
      confirmed: pairingState.confirmed,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/pairing', (_req, res) => {
  res.locals.routePath = '/zigbee/pairing';
  pairingState.active = false;
  pairingState.startedAt = null;
  pairingState.expiresAt = null;
  res.json({
    active: pairingState.active,
    startedAt: pairingState.startedAt,
    expiresAt: pairingState.expiresAt,
    discovered: pairingState.discovered,
    confirmed: pairingState.confirmed,
  });
});

router.get('/pairing/discovered', (_req, res) => {
  res.locals.routePath = '/zigbee/pairing/discovered';
  res.json({
    active: pairingState.active,
    startedAt: pairingState.startedAt,
    expiresAt: pairingState.expiresAt,
    discovered: pairingState.discovered,
    confirmed: pairingState.confirmed,
  });
});

router.post('/pairing/:deviceId', (req, res) => {
  res.locals.routePath = '/zigbee/pairing/:deviceId';
  const { deviceId } = req.params;
  pairingState.confirmed.push(deviceId);
  pairingState.discovered = pairingState.discovered.filter((device) => device.id !== deviceId);
  res.status(202).json({ accepted: true, deviceId });
});

router.get('/rules', async (_req, res, next) => {
  res.locals.routePath = '/zigbee/rules';
  try {
    const rules = await listZigbeeRules();
    res.json({ items: rules, total: rules.length });
  } catch (error) {
    next(error);
  }
});

router.post('/rules/validate', (req, res, next) => {
  res.locals.routePath = '/zigbee/rules/validate';
  try {
    const payload = validateZigbeeRuleDefinition(req.body);
    res.json({ valid: true, normalized: payload, evaluatedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.post('/rules', async (req, res, next) => {
  res.locals.routePath = '/zigbee/rules';
  try {
    const record = await createZigbeeRule(req.body);
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

router.get('/rules/:ruleId', async (req, res, next) => {
  res.locals.routePath = '/zigbee/rules/:ruleId';
  try {
    const rule = await getZigbeeRule(req.params.ruleId);
    res.json(rule);
  } catch (error) {
    next(error);
  }
});

router.put('/rules/:ruleId', async (req, res, next) => {
  res.locals.routePath = '/zigbee/rules/:ruleId';
  try {
    const payload = ruleUpdateSchema.parse(req.body);
    if (!payload || Object.keys(payload).length === 0) {
      throw createHttpError(400, 'bad_request', 'No fields provided for update');
    }
    const updated = await updateZigbeeRule(req.params.ruleId, payload);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/rules/:ruleId', async (req, res, next) => {
  res.locals.routePath = '/zigbee/rules/:ruleId';
  try {
    await deleteZigbeeRule(req.params.ruleId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.patch('/rules/:ruleId/enable', async (req, res, next) => {
  res.locals.routePath = '/zigbee/rules/:ruleId/enable';
  try {
    const body = z.object({ enabled: z.boolean().default(true) }).parse(req.body ?? {});
    const updated = await updateZigbeeRule(req.params.ruleId, { enabled: body.enabled });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/rules/simulate', async (req, res, next) => {
  res.locals.routePath = '/zigbee/rules/simulate';
  try {
    const payload = ruleSimulationSchema.parse(req.body ?? {});
    const result = await simulateZigbeeRule(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export const zigbeeRouter = router;
