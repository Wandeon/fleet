import { Router } from 'express';
import { z } from 'zod';
import { deviceRegistry } from '../upstream/devices';

const router = Router();

router.get('/', (req, res) => {
  res.locals.routePath = '/zigbee';
  const devices = deviceRegistry
    .list()
    .filter((device) => device.module === 'zigbee' || device.role.includes('zigbee'));
  res.json({
    message: 'Zigbee API endpoint',
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

router.get('/devices/:id/status', (req, res) => {
  res.locals.routePath = '/zigbee/devices/:id/status';
  const { id } = req.params;
  const device = deviceRegistry.getDevice(id);

  if (!device || (device.module !== 'zigbee' && !device.role.includes('zigbee'))) {
    return res.status(404).json({
      error: 'Zigbee device not found',
      id
    });
  }

  res.json({
    id: device.id,
    name: device.name,
    status: 'offline',
    reason: 'Zigbee communication not implemented',
    timestamp: new Date().toISOString()
  });
});

router.get('/devices', (req, res) => {
  res.locals.routePath = '/zigbee/devices';
  const devices = deviceRegistry
    .list()
    .filter((device) => device.module === 'zigbee' || device.role.includes('zigbee'))
    .map((device) => ({
      id: device.id,
      name: device.name,
      role: device.role,
      module: device.module,
      status: 'unimplemented'
    }));

  res.json({ devices, updatedAt: new Date().toISOString() });
});

const actionSchema = z.object({
  deviceId: z.string(),
  command: z.string(),
  payload: z.record(z.string(), z.unknown()).optional()
});

router.post('/actions', (req, res, next) => {
  res.locals.routePath = '/zigbee/actions';
  try {
    const payload = actionSchema.parse(req.body);
    res.json({
      accepted: false,
      message: 'Zigbee control not yet implemented',
      request: payload
    });
  } catch (error) {
    next(error);
  }
});

export const zigbeeRouter = router;
