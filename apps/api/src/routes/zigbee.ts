import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { deviceRegistry } from '../upstream/devices';

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
  confirmed: []
};

const ruleStore = new Map<
  string,
  {
    id: string;
    name: string;
    trigger: Record<string, unknown>;
    actions: Record<string, unknown>[];
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  }
>();

const pairingStartSchema = z.object({
  durationSeconds: z.coerce.number().int().min(30).max(900).default(300),
  channel: z.coerce.number().int().min(11).max(26).optional()
});

const actionSchema = z.object({
  deviceId: z.string(),
  command: z.string(),
  payload: z.record(z.string(), z.unknown()).optional()
});

const ruleSchema = z.object({
  name: z.string().min(1),
  trigger: z.record(z.string(), z.unknown()),
  actions: z.array(z.record(z.string(), z.unknown())).min(1)
});

router.get('/overview', (_req, res) => {
  res.locals.routePath = '/zigbee/overview';
  const devices = deviceRegistry
    .list()
    .filter((device) => device.module === 'zigbee' || device.role.includes('zigbee'))
    .map((device) => ({
      id: device.id,
      name: device.name,
      model: 'unknown',
      lastSeen: new Date().toISOString(),
      status: pairingState.confirmed.includes(device.id) ? 'paired' : 'unverified'
    }));

  res.json({
    hub: {
      id: 'zigbee-hub',
      status: pairingState.active ? 'pairing' : 'online',
      channel: 20,
      lastHeartbeatAt: new Date().toISOString()
    },
    pairing: {
      active: pairingState.active,
      startedAt: pairingState.startedAt,
      expiresAt: pairingState.expiresAt,
      discovered: pairingState.discovered,
      confirmed: pairingState.confirmed
    },
    devices,
    rules: Array.from(ruleStore.values()).map((rule) => ({
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    }))
  });
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
      status: pairingState.confirmed.includes(device.id) ? 'paired' : 'discovered'
    }))
  });
});

router.get('/devices/:id/status', (req, res) => {
  res.locals.routePath = '/zigbee/devices/:id/status';
  const { id } = req.params;
  const device = deviceRegistry.getDevice(id);

  if (!device || (device.module !== 'zigbee' && !device.role.includes('zigbee'))) {
    return res.status(404).json({
      error: 'Zigbee device not found',
      id
    });
  }

  res.json({
    id: device.id,
    name: device.name,
    status: pairingState.confirmed.includes(device.id) ? 'paired' : 'pending',
    timestamp: new Date().toISOString()
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
      status: pairingState.confirmed.includes(device.id) ? 'paired' : 'pending'
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
      receivedAt: new Date().toISOString()
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
        signal: -52
      }
    ];
    res.json({
      active: pairingState.active,
      startedAt: pairingState.startedAt,
      expiresAt: pairingState.expiresAt,
      discovered: pairingState.discovered,
      confirmed: pairingState.confirmed
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
    confirmed: pairingState.confirmed
  });
});

router.get('/pairing/discovered', (_req, res) => {
  res.locals.routePath = '/zigbee/pairing/discovered';
  res.json({
    active: pairingState.active,
    startedAt: pairingState.startedAt,
    expiresAt: pairingState.expiresAt,
    discovered: pairingState.discovered,
    confirmed: pairingState.confirmed
  });
});

router.post('/pairing/:deviceId', (req, res) => {
  res.locals.routePath = '/zigbee/pairing/:deviceId';
  const { deviceId } = req.params;
  pairingState.confirmed.push(deviceId);
  pairingState.discovered = pairingState.discovered.filter((device) => device.id !== deviceId);
  res.status(202).json({ accepted: true, deviceId });
});

router.get('/rules', (_req, res) => {
  res.locals.routePath = '/zigbee/rules';
  const rules = Array.from(ruleStore.values());
  res.json({ items: rules, total: rules.length });
});

router.post('/rules/validate', (req, res, next) => {
  res.locals.routePath = '/zigbee/rules/validate';
  try {
    const payload = ruleSchema.parse(req.body);
    res.json({ valid: true, normalized: payload, evaluatedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.post('/rules', (req, res, next) => {
  res.locals.routePath = '/zigbee/rules';
  try {
    const payload = ruleSchema.parse(req.body);
    const now = new Date().toISOString();
    const id = randomUUID();
    const record = {
      id,
      name: payload.name,
      trigger: payload.trigger,
      actions: payload.actions,
      enabled: true,
      createdAt: now,
      updatedAt: now
    };
    ruleStore.set(id, record);
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

router.post('/rules/:ruleId/enable', (req, res) => {
  res.locals.routePath = '/zigbee/rules/:ruleId/enable';
  const { ruleId } = req.params;
  const enabled = z.object({ enabled: z.boolean().default(true) }).parse(req.body ?? {});
  const existing = ruleStore.get(ruleId);
  if (!existing) {
    res.status(404).json({ code: 'not_found', message: 'Rule not found' });
    return;
  }
  const updated = {
    ...existing,
    enabled: enabled.enabled,
    updatedAt: new Date().toISOString()
  };
  ruleStore.set(ruleId, updated);
  res.json(updated);
});

export const zigbeeRouter = router;
