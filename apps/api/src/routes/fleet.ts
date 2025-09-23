import { Router } from 'express';
import { deviceRegistry } from '../upstream/devices';
import { fetchStatus } from '../upstream/audio';
import { isHttpError } from '../util/errors';

const router = Router();

router.get('/layout', (req, res) => {
  res.locals.routePath = '/fleet/layout';
  const modules = new Map<string, { module: string; devices: unknown[] }>();

  for (const device of deviceRegistry.list()) {
    const moduleId = device.module;
    if (!modules.has(moduleId)) {
      modules.set(moduleId, {
        module: moduleId,
        devices: []
      });
    }

    const entry = modules.get(moduleId);
    entry?.devices.push({
      id: device.id,
      name: device.name,
      role: device.role,
      kind: device.kind,
      capabilities: device.capabilities
    });
  }

  res.json({
    modules: Array.from(modules.values()),
    generatedAt: new Date().toISOString()
  });
});

router.get('/state', async (req, res) => {
  res.locals.routePath = '/fleet/state';
  const audioDevices = deviceRegistry.listByRole('audio');

  const devices = await Promise.all(
    audioDevices.map(async (device) => {
      try {
        const status = await fetchStatus(device, req.correlationId);
        return {
          id: device.id,
          name: device.name,
          role: device.role,
          module: device.module,
          online: true,
          status
        };
      } catch (error) {
        const reason = isHttpError(error) ? error.message : 'Unknown error';
        const code = isHttpError(error) ? error.code : 'upstream_error';
        return {
          id: device.id,
          name: device.name,
          role: device.role,
          module: device.module,
          online: false,
          reason,
          code
        };
      }
    })
  );
  const online = devices.filter((device) => device.online).length;

  res.json({
    audio: {
      total: devices.length,
      online,
      devices
    },
    updatedAt: new Date().toISOString()
  });
});

export const fleetRouter = router;
