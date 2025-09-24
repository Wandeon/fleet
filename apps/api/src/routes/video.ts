import { Router } from 'express';
import { deviceRegistry } from '../upstream/devices';

const router = Router();

router.get('/', (req, res) => {
  res.locals.routePath = '/video';
  const devices = deviceRegistry
    .list()
    .filter((device) => device.module === 'video' || device.role.includes('video'));
  res.json({
    message: 'Video API endpoint',
    status: 'active',
    timestamp: new Date().toISOString(),
    total: devices.length,
    online: 0,
    devices: devices.map(device => ({
      id: device.id,
      name: device.name,
      status: 'offline'
    }))
  });
});

// Add missing displays endpoints
router.get('/displays', (req, res) => {
  res.locals.routePath = '/video/displays';
  const displays = deviceRegistry
    .list()
    .filter((device) => device.module === 'video' || device.role.includes('video'))
    .map((device) => ({
      id: device.id,
      name: device.name,
      role: device.role,
      module: device.module,
      status: 'offline'
    }));

  res.json({
    displays,
    total: displays.length,
    updatedAt: new Date().toISOString()
  });
});

router.get('/displays/:id/status', (req, res) => {
  res.locals.routePath = '/video/displays/:id/status';
  const { id } = req.params;
  const device = deviceRegistry.getDevice(id);

  if (!device || (device.module !== 'video' && !device.role.includes('video'))) {
    return res.status(404).json({
      error: 'Display not found',
      id
    });
  }

  res.json({
    id: device.id,
    name: device.name,
    status: 'offline',
    reason: 'Device communication not implemented',
    timestamp: new Date().toISOString()
  });
});

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
