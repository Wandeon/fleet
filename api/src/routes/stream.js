import { Router } from 'express';
import { bus, EVENTS } from '../events/bus.js';
import { listDeviceStates } from '../services/deviceService.js';
import { prisma } from '../db/client.js';
import { sseClientsGauge } from '../metrics/index.js';

const HEARTBEAT_MS = 25000;

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (event, payload) => {
      res.write(event: \n);
      res.write(data: \n\n);
    };

    const heartbeat = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, HEARTBEAT_MS);

    sseClientsGauge.inc();

    const states = await listDeviceStates();
    const jobs = await prisma.job.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    send('snapshot', { states, jobs });

    const onJobCreated = (job) => send('job.created', job);
    const onJobUpdated = (job) => send('job.updated', job);
    const onStateUpdated = ({ deviceId, state }) => send('state.updated', { deviceId, state });
    const onEventAppended = ({ deviceId, event }) => send('event.appended', { deviceId, event });

    bus.on(EVENTS.JOB_CREATED, onJobCreated);
    bus.on(EVENTS.JOB_UPDATED, onJobUpdated);
    bus.on(EVENTS.STATE_UPDATED, onStateUpdated);
    bus.on(EVENTS.EVENT_APPENDED, onEventAppended);

    const close = () => {
      clearInterval(heartbeat);
      sseClientsGauge.dec();
      bus.off(EVENTS.JOB_CREATED, onJobCreated);
      bus.off(EVENTS.JOB_UPDATED, onJobUpdated);
      bus.off(EVENTS.STATE_UPDATED, onStateUpdated);
      bus.off(EVENTS.EVENT_APPENDED, onEventAppended);
      res.end();
    };

    req.on('close', close);
  } catch (err) {
    next(err);
  }
});

export default router;
