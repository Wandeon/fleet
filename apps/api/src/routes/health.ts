import { Router } from 'express';
import { z } from 'zod';
import { listEvents } from '../observability/events';
import { deviceRegistry } from '../upstream/devices';
import { fetchStatus } from '../upstream/audio';
import { isHttpError } from '../util/errors';

const router = Router();

router.get('/summary', async (req, res) => {
  res.locals.routePath = '/health/summary';
  const modules = new Map<string, { module: string; total: number; online: number; devices: unknown[] }>();

  const audioDevices = deviceRegistry.listByRole('audio');
  const audioSummaries = await Promise.all(
    audioDevices.map(async (device) => {
      try {
        await fetchStatus(device, req.correlationId);
        return { id: device.id, status: 'online' };
      } catch (error) {
        const reason = isHttpError(error) ? error.code : 'unknown';
        return { id: device.id, status: 'offline', reason };
      }
    })
  );

  modules.set('audio', {
    module: 'audio',
    total: audioSummaries.length,
    online: audioSummaries.filter((entry) => entry.status === 'online').length,
    devices: audioSummaries
  });

  for (const device of deviceRegistry.list()) {
    if (device.role === 'audio') {
      continue;
    }
    const entry = modules.get(device.module) ?? {
      module: device.module,
      total: 0,
      online: 0,
      devices: [] as unknown[]
    };
    entry.total += 1;
    entry.devices.push({ id: device.id, status: 'unknown' });
    modules.set(device.module, entry);
  }

  res.json({
    modules: Array.from(modules.values()),
    updatedAt: new Date().toISOString()
  });
});

const eventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional()
});

router.get('/events/recent', (req, res, next) => {
  res.locals.routePath = '/health/events/recent';
  try {
    const { limit } = eventsQuerySchema.parse(req.query);
    const events = listEvents(limit);
    res.json({ events, count: events.length });
  } catch (error) {
    next(error);
  }
});

export const healthSummaryRouter = router;
