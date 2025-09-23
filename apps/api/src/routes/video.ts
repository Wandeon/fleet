import { Router } from 'express';
import { deviceRegistry } from '../upstream/devices';

const router = Router();

router.get('/devices', (req, res) => {
  res.locals.routePath = '/video/devices';
  const devices = deviceRegistry
    .list()
    .filter((device) => device.module === 'video' || device.role.includes('video'))
    .map((device) => ({
      id: device.id,
      name: device.name,
      role: device.role,
      module: device.module,
      status: 'unimplemented'
    }));

  res.json({ devices, updatedAt: new Date().toISOString() });
});

router.post('/devices/:deviceId/commands', (req, res) => {
  res.locals.routePath = '/video/devices/:deviceId/commands';
  const { deviceId } = req.params;
  res.json({
    deviceId,
    accepted: false,
    message: 'Video control coming soon'
  });
});

export const videoRouter = router;
