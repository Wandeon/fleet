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
import { log } from '../observability/logging.js';

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

let pairingTimeout: NodeJS.Timeout | null = null;

function closePairingWindow() {
  if (pairingTimeout) {
    clearTimeout(pairingTimeout);
    pairingTimeout = null;
  }
  pairingState.active = false;
  pairingState.startedAt = null;
  pairingState.expiresAt = null;
  pairingState.discovered = [];
}

function refreshPairingWindow() {
  if (!pairingState.active || !pairingState.expiresAt) {
    return;
  }
  const expiresAt = new Date(pairingState.expiresAt).getTime();
  if (Number.isNaN(expiresAt) || Date.now() >= expiresAt) {
    closePairingWindow();
  }
}

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
    refreshPairingWindow();
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
  refreshPairingWindow();
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
  refreshPairingWindow();
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
  refreshPairingWindow();
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
    const commandId = randomUUID();
    log.info(
      {
        deviceId: payload.deviceId,
        command: payload.command,
        commandId,
      },
      'Zigbee device command sent'
    );
    res.status(202).json({
      accepted: true,
      commandId,
      deviceId: payload.deviceId,
      command: payload.command,
      receivedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ error }, 'Failed to send zigbee device command');
    next(error);
  }
});

router.post('/devices/:id/command', (req, res, next) => {
  res.locals.routePath = '/zigbee/devices/:id/command';
  try {
    const { id } = req.params;
    const { command, payload } = req.body;

    if (!command) {
      throw createHttpError(400, 'bad_request', 'command is required');
    }

    const device = deviceRegistry.getDevice(id);
    if (!device || (device.module !== 'zigbee' && !device.role.includes('zigbee'))) {
      throw createHttpError(404, 'not_found', `Zigbee device ${id} not found`);
    }

    const commandId = randomUUID();
    log.info(
      {
        deviceId: id,
        command,
        commandId,
      },
      'Zigbee device command sent'
    );

    res.status(202).json({
      accepted: true,
      commandId,
      deviceId: id,
      command,
      payload,
      receivedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ deviceId: req.params.id, error }, 'Failed to send zigbee device command');
    next(error);
  }
});

router.post('/devices/:id/action', (req, res, next) => {
  res.locals.routePath = '/zigbee/devices/:id/action';
  try {
    const { id } = req.params;
    const { deviceId, command } = req.body;

    if (!deviceId || !command) {
      throw createHttpError(400, 'bad_request', 'deviceId and command are required');
    }

    const device = deviceRegistry.getDevice(id);
    if (!device || (device.module !== 'zigbee' && !device.role.includes('zigbee'))) {
      throw createHttpError(404, 'not_found', `Zigbee device ${id} not found`);
    }

    log.info(
      {
        deviceId: id,
        command,
      },
      'Zigbee device action requested (stub)'
    );

    // Return stub response with accepted: false
    res.status(202).json({
      accepted: false,
      deviceId: id,
      command,
      reason: 'Direct device actions are not yet implemented. Use automation rules instead.',
      receivedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ deviceId: req.params.id, error }, 'Failed to execute zigbee device action');
    next(error);
  }
});

router.post('/pairing', (req, res, next) => {
  res.locals.routePath = '/zigbee/pairing';
  try {
    const payload = pairingStartSchema.parse(req.body ?? {});
    const now = new Date();
    log.info({ durationSeconds: payload.durationSeconds, channel: payload.channel }, 'Zigbee pairing mode started');
    closePairingWindow();
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
    pairingTimeout = setTimeout(() => {
      closePairingWindow();
    }, payload.durationSeconds * 1000);
    res.json({
      active: pairingState.active,
      startedAt: pairingState.startedAt,
      expiresAt: pairingState.expiresAt,
      discovered: pairingState.discovered,
      confirmed: pairingState.confirmed,
    });
  } catch (error) {
    log.error({ error }, 'Failed to start zigbee pairing mode');
    next(error);
  }
});

router.delete('/pairing', (_req, res) => {
  res.locals.routePath = '/zigbee/pairing';
  log.info({ discovered: pairingState.discovered.length }, 'Zigbee pairing mode stopped');
  closePairingWindow();
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
  refreshPairingWindow();
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
  log.info({ deviceId }, 'Zigbee device pairing confirmed');
  pairingState.confirmed = Array.from(new Set([...pairingState.confirmed, deviceId]));
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
    log.info({ ruleName: req.body?.name }, 'Zigbee rule creation requested');
    const record = await createZigbeeRule(req.body);
    log.info({ ruleId: record.id, ruleName: record.name, enabled: record.enabled }, 'Zigbee rule created');
    res.status(201).json(record);
  } catch (error) {
    log.error({ error }, 'Failed to create zigbee rule');
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
    log.info({ ruleId: req.params.ruleId, fields: Object.keys(payload) }, 'Zigbee rule update requested');
    const updated = await updateZigbeeRule(req.params.ruleId, payload);
    log.info({ ruleId: updated.id, ruleName: updated.name }, 'Zigbee rule updated');
    res.json(updated);
  } catch (error) {
    log.error({ ruleId: req.params.ruleId, error }, 'Failed to update zigbee rule');
    next(error);
  }
});

router.delete('/rules/:ruleId', async (req, res, next) => {
  res.locals.routePath = '/zigbee/rules/:ruleId';
  try {
    log.info({ ruleId: req.params.ruleId }, 'Zigbee rule deletion requested');
    await deleteZigbeeRule(req.params.ruleId);
    log.info({ ruleId: req.params.ruleId }, 'Zigbee rule deleted');
    res.status(204).send();
  } catch (error) {
    log.error({ ruleId: req.params.ruleId, error }, 'Failed to delete zigbee rule');
    next(error);
  }
});

router.patch('/rules/:ruleId/enable', async (req, res, next) => {
  res.locals.routePath = '/zigbee/rules/:ruleId/enable';
  try {
    const body = z.object({ enabled: z.boolean().default(true) }).parse(req.body ?? {});
    log.info({ ruleId: req.params.ruleId, enabled: body.enabled }, 'Zigbee rule enable/disable requested');
    const updated = await updateZigbeeRule(req.params.ruleId, { enabled: body.enabled });
    log.info({ ruleId: updated.id, ruleName: updated.name, enabled: updated.enabled }, 'Zigbee rule toggled');
    res.json(updated);
  } catch (error) {
    log.error({ ruleId: req.params.ruleId, error }, 'Failed to toggle zigbee rule');
    next(error);
  }
});

router.post('/rules/simulate', async (req, res, next) => {
  res.locals.routePath = '/zigbee/rules/simulate';
  try {
    const payload = ruleSimulationSchema.parse(req.body ?? {});
    log.info({ ruleId: payload.ruleId }, 'Zigbee rule simulation requested');
    const result = await simulateZigbeeRule(payload);
    log.info({ ruleId: payload.ruleId, matched: result.matched }, 'Zigbee rule simulated');
    res.json(result);
  } catch (error) {
    log.error({ error }, 'Failed to simulate zigbee rule');
    next(error);
  }
});

export const zigbeeRouter = router;
