import express from 'express';
import { prisma } from '../lib/db.js';
import { auth } from './util-auth.js';
import { enqueueJob } from '../services/jobs.js';
import { sseHandler } from './sse.js';
import { fetchLogs } from '../services/logs.js';
import { log } from '../observability/logging.js';
import { executeOperation, OperationError } from '../services/operations.js';
import { parseJson, parseJsonOr } from '../lib/json.js';

type DeviceRecord = Awaited<ReturnType<typeof prisma.device.findMany>>[number];
type DeviceStateRecord = Awaited<ReturnType<typeof prisma.deviceState.findMany>>[number];
type DeviceEventRecord = Awaited<ReturnType<typeof prisma.deviceEvent.findMany>>[number];
type JobRecord = Awaited<ReturnType<typeof prisma.job.findMany>>[number];

function serializeDevice(device: DeviceRecord) {
  return {
    ...device,
    address: parseJsonOr<Record<string, unknown>>(device.address, {}),
    capabilities: parseJsonOr<Record<string, unknown>>(device.capabilities, {}),
  };
}

function serializeStateRecord(state: DeviceStateRecord) {
  return {
    ...state,
    state: parseJsonOr<Record<string, unknown>>(state.state, {}),
  };
}

function serializeState(state: DeviceStateRecord | null) {
  return state ? serializeStateRecord(state) : null;
}

function serializeEvent(event: DeviceEventRecord) {
  return {
    ...event,
    payload: parseJsonOr<Record<string, unknown>>(event.payload, {}),
  };
}

function serializeJob(job: JobRecord | null) {
  if (!job) return null;
  return {
    ...job,
    payload: parseJson(job.payload),
  };
}

export const router = express.Router();
router.use(express.json());

router.use(auth(process.env.API_BEARER || ''));

router.get('/stream', sseHandler);

router.get('/logs', async (req, res) => {
  const { source, limit, since, range, range_minutes, direction } = req.query as {
    source?: string;
    limit?: string;
    since?: string;
    range?: string;
    range_minutes?: string;
    direction?: string;
  };

  let sinceDate: Date | undefined;
  if (since) {
    const parsed = new Date(since);
    if (!Number.isNaN(parsed.getTime())) {
      sinceDate = parsed;
    }
  }

  const limitValue = limit ? Number.parseInt(limit, 10) : undefined;
  const normalizedLimit = Number.isFinite(limitValue ?? NaN) ? limitValue : undefined;

  const rangeParam = range ?? range_minutes;
  let rangeMinutes: number | undefined;
  if (rangeParam) {
    const parsedRange = Number.parseInt(rangeParam, 10);
    if (Number.isFinite(parsedRange) && parsedRange > 0) {
      rangeMinutes = parsedRange;
    }
  }

  try {
    const result = await fetchLogs({
      sourceId: source,
      limit: normalizedLimit,
      since: sinceDate,
      rangeMinutes,
      direction: direction === 'forward' ? 'forward' : 'backward',
    });
    res.json(result);
  } catch (err) {
    const status = typeof (err)?.status === 'number' ? (err).status : 502;
    const message = err instanceof Error ? err.message : 'Failed to query logs';
    log.error({ err: message, status }, 'logs endpoint error');
    res.status(status).json({ error: message });
  }
});

function normalizeComponentStatus(status?: string | null) {
  const value = (status || '').toLowerCase();
  if (value === 'online' || value === 'up' || value === 'healthy') return 'UP';
  if (value === 'degraded' || value === 'warning' || value === 'partial') return 'DEGRADED';
  if (value === 'offline' || value === 'down' || value === 'error') return 'DOWN';
  return 'UNKNOWN';
}

router.get('/health', async (_req, res) => {
  const [devices, states] = await Promise.all([
    prisma.device.findMany({ select: { id: true, name: true, kind: true } }),
    prisma.deviceState.findMany({ orderBy: { updatedAt: 'desc' } }),
  ]);

  const latestState = new Map<string, (typeof states)[number]>();
  for (const state of states) {
    if (!latestState.has(state.deviceId)) {
      latestState.set(state.deviceId, state);
    }
  }

  const components: Record<string, string> = {};
  const details = devices.map((device) => {
    const state = latestState.get(device.id);
    const componentStatus = normalizeComponentStatus(state?.status);
    components[device.id] = componentStatus;
    return {
      id: device.id,
      name: device.name,
      kind: device.kind,
      status: componentStatus,
      updatedAt: state?.updatedAt?.toISOString() ?? null,
      lastSeen: state?.lastSeen?.toISOString() ?? null,
    };
  });

  const componentValues = Object.values(components);
  const overall = componentValues.length
    ? componentValues.includes('DOWN')
      ? 'DOWN'
      : componentValues.includes('DEGRADED')
        ? 'DEGRADED'
        : 'UP'
    : 'UNKNOWN';

  res.json({
    overall,
    components,
    devices: details,
    timestamp: new Date().toISOString(),
  });
});

router.get('/devices', async (_req, res) => {
  const devices = await prisma.device.findMany();
  res.json({ devices: devices.map(serializeDevice) });
});

router.get('/devices/:id', async (req, res) => {
  const device = await prisma.device.findUnique({ where: { id: req.params.id } });
  if (!device) {
    res.status(404).json({ error: 'device not found' });
    return;
  }
  res.json({ device: serializeDevice(device) });
});

router.get('/device_states', async (_req, res) => {
  const states = await prisma.deviceState.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json({ states: states.map((state) => serializeStateRecord(state)) });
});

router.get('/devices/:id/state', async (req, res) => {
  const state = await prisma.deviceState.findFirst({
    where: { deviceId: req.params.id },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ state: serializeState(state) });
});

router.get('/device_events', async (req, res) => {
  const { device_id, since } = req.query as { device_id?: string; since?: string };
  const events = await prisma.deviceEvent.findMany({
    where: {
      deviceId: device_id || undefined,
      at: since ? { gt: new Date(since) } : undefined,
    },
    orderBy: { at: 'asc' },
  });
  res.json({ events: events.map(serializeEvent) });
});

router.post('/video/devices/:id/tv/power_on', async (req, res) => {
  const job = await enqueueJob(req.params.id, 'tv.power_on', null);
  res.json({ accepted: true, job_id: job.id, ok: true });
});

router.post('/video/devices/:id/tv/power_off', async (req, res) => {
  const job = await enqueueJob(req.params.id, 'tv.power_off', null);
  res.json({ accepted: true, job_id: job.id, ok: true });
});

router.post('/video/devices/:id/tv/input', async (req, res) => {
  const job = await enqueueJob(req.params.id, 'tv.input', { source: req.body?.source });
  res.json({ accepted: true, job_id: job.id, ok: true });
});

router.get('/jobs/:id', async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  res.json({ job: serializeJob(job) });
});

router.post('/operations/:deviceId/:operationId', async (req, res) => {
  try {
    const result = await executeOperation(req.params.deviceId, req.params.operationId, req.body);
    res.status(result.status).json({
      ok: result.ok,
      status: result.status,
      data: result.data,
      headers: result.headers,
    });
  } catch (error) {
    if (error instanceof OperationError) {
      res.status(error.status).json({ error: error.message, data: error.data ?? null });
      return;
    }
    log.error({ err: error instanceof Error ? error.message : error }, 'operation execution failed');
    res.status(500).json({ error: 'internal error' });
  }
});
