import express from 'express';
import { prisma } from '../lib/db.js';
import { auth } from './util-auth.js';
import { enqueueJob } from '../services/jobs.js';
import { sseHandler } from './sse.js';
import { fetchLogs } from '../services/logs.js';
import { log } from '../lib/logger.js';

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
    const status = typeof (err as any)?.status === 'number' ? (err as any).status : 502;
    const message = err instanceof Error ? err.message : 'Failed to query logs';
    log.error({ err: message, status }, 'logs endpoint error');
    res.status(status).json({ error: message });
  }
});

router.get('/devices', async (_req, res) => {
  const devices = await prisma.device.findMany();
  res.json({ devices });
});

router.get('/device_states', async (_req, res) => {
  const states = await prisma.deviceState.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json({ states });
});

router.get('/devices/:id/state', async (req, res) => {
  const state = await prisma.deviceState.findFirst({
    where: { deviceId: req.params.id },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ state });
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
  res.json({ events });
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
  res.json({ job });
});
