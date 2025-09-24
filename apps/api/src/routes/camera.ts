import { Router } from 'express';
import { deviceRegistry } from '../upstream/devices';

const router = Router();

router.get('/', (req, res) => {
  res.locals.routePath = '/camera';
  const devices = deviceRegistry
    .list()
    .filter((device) => device.module === 'camera' || device.role.includes('camera'));
  res.json({
    message: 'Camera API endpoint',
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

// Add standard streams endpoint
router.get('/streams', (req, res) => {
  res.locals.routePath = '/camera/streams';
  const streams = deviceRegistry
    .list()
    .filter((device) => device.module === 'camera' || device.role.includes('camera'))
    .map((device) => ({
      id: device.id,
      name: device.name,
      role: device.role,
      module: device.module,
      status: 'offline'
    }));

  res.json({
    streams,
    total: streams.length,
    updatedAt: new Date().toISOString()
  });
});

router.get('/streams/:id/status', (req, res) => {
  res.locals.routePath = '/camera/streams/:id/status';
  const { id } = req.params;
  const device = deviceRegistry.getDevice(id);

  if (!device || (device.module !== 'camera' && !device.role.includes('camera'))) {
    return res.status(404).json({
      error: 'Camera stream not found',
      id
    });
  }

  res.json({
    id: device.id,
    name: device.name,
    status: 'offline',
    reason: 'Camera stream not implemented',
    timestamp: new Date().toISOString()
  });
});

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
