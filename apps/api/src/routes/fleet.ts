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
        devices: [],
      });
    }

    const entry = modules.get(moduleId);
    entry?.devices.push({
      id: device.id,
      name: device.name,
      role: device.role,
      kind: device.kind,
      capabilities: device.capabilities,
    });
  }

  res.json({
    modules: Array.from(modules.values()),
    generatedAt: new Date().toISOString(),
  });
});

router.get('/overview', async (req, res) => {
  res.locals.routePath = '/fleet/overview';
  const allDevices = deviceRegistry.list();
  const moduleStats = new Map<string, { online: number; offline: number; degraded: number; devices: any[] }>();

  // Group devices by module and calculate stats
  for (const device of allDevices) {
    const moduleId = device.module;
    if (!moduleStats.has(moduleId)) {
      moduleStats.set(moduleId, { online: 0, offline: 0, degraded: 0, devices: [] });
    }

    const stats = moduleStats.get(moduleId)!;
    // For now, assume all devices are online (emergency fix)
    stats.online += 1;
    stats.devices.push({
      id: device.id,
      name: device.name,
      role: device.role,
      status: 'online'
    });
  }

  const modules = Array.from(moduleStats.entries()).map(([id, stats]) => ({
    id,
    label: id.replace(/[-_]/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase()),
    online: stats.online,
    offline: stats.offline,
    degraded: stats.degraded,
    devices: stats.devices
  }));

  const totals = {
    devices: allDevices.length,
    online: allDevices.length,
    offline: 0,
    degraded: 0
  };

  // Enhanced device information for fleet overview
  const devices = allDevices.map(d => ({
    id: d.id,
    name: d.name,
    role: d.role,
    module: d.module,
    status: 'online' as const,
    location: d.metadata?.location as string || null,
    lastSeen: new Date().toISOString(), // Use current time as placeholder
    uptime: '0d 0h 0m', // Placeholder uptime
    ipAddress: 'unknown', // Placeholder IP
    version: d.metadata?.version as string || 'unknown'
  }));

  res.json({
    totals,
    modules,
    devices,
    updatedAt: new Date().toISOString(),
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
          status,
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
          code,
        };
      }
    })
  );
  const online = devices.filter((device) => device.online).length;

  res.json({
    audio: {
      total: devices.length,
      online,
      devices,
    },
    updatedAt: new Date().toISOString(),
  });
});

export const fleetRouter = router;
