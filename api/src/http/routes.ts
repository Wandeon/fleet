import express from 'express';
import { prisma } from '../lib/db.js';
import { auth } from './util-auth.js';
import { enqueueJob } from '../services/jobs.js';
import { metricsHandler } from '../lib/metrics.js';
import { sseHandler } from './sse.js';

export const router = express.Router();
router.use(express.json());

router.get('/metrics', metricsHandler);
router.get('/stream', sseHandler);
router.use(auth(process.env.API_BEARER || ''));

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
