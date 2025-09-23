import { Router } from 'express';
import { deviceRegistry } from '../upstream/devices';

const router = Router();

router.get('/summary', (req, res) => {
  res.locals.routePath = '/camera/summary';
  const cameras = deviceRegistry
    .list()
    .filter((device) => device.module === 'camera' || device.role.includes('camera'))
    .map((device) => ({
      id: device.id,
      name: device.name,
      role: device.role,
      module: device.module,
      status: 'unimplemented'
    }));

  res.json({ cameras, updatedAt: new Date().toISOString() });
});

router.get('/events', (_req, res) => {
  res.locals.routePath = '/camera/events';
  res.json({ events: [], updatedAt: new Date().toISOString() });
});

export const cameraRouter = router;
