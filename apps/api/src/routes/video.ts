import { Router } from 'express';
import { z } from 'zod';
import {
  listVideoDevices,
  setDevicePower,
  setDeviceMute,
  setDeviceInput,
  requestPreviewSession,
  listRecordingSegments,
  createClipExport
} from '../services/video.js';

const router = Router();

const powerSchema = z.object({ power: z.enum(['on', 'standby']) });
const muteSchema = z.object({ mute: z.boolean() });
const inputSchema = z.object({ input: z.string().min(1) });
const previewSchema = z.object({ deviceId: z.string().min(1).optional() });
const clipExportSchema = z.object({
  startOffsetSeconds: z.coerce.number().min(0),
  endOffsetSeconds: z.coerce.number().min(0)
});

router.get('/', (_req, res) => {
  res.locals.routePath = '/video';
  const devices = listVideoDevices();
  res.json({
    message: 'Video API endpoint',
    status: 'active',
    timestamp: new Date().toISOString(),
    total: devices.length,
    devices
  });
});

router.get('/overview', (_req, res) => {
  res.locals.routePath = '/video/overview';
  const devices = listVideoDevices();
  const online = devices.filter((device) => device.power === 'on').length;
  res.json({
    devices,
    total: devices.length,
    online,
    updatedAt: new Date().toISOString()
  });
});

// Add missing displays endpoints
router.get('/displays', (_req, res) => {
  res.locals.routePath = '/video/displays';
  const displays = listVideoDevices().map((device) => ({
    id: device.id,
    name: device.name,
    role: device.role,
    module: device.module,
    status: device.status
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
  const device = listVideoDevices().find((item) => item.id === id);

  if (!device) {
    return res.status(404).json({
      error: 'Display not found',
      id
    });
  }

  res.json({
    id: device.id,
    name: device.name,
    status: device.status,
    power: device.power,
    timestamp: new Date().toISOString()
  });
});

router.get('/devices', (req, res) => {
  res.locals.routePath = '/video/devices';
  const devices = listVideoDevices();
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

router.post('/devices/:deviceId/power', (req, res, next) => {
  res.locals.routePath = '/video/devices/:deviceId/power';
  try {
    const { deviceId } = req.params;
    const payload = powerSchema.parse(req.body);
    const updated = setDevicePower(deviceId, payload.power);
    res.status(202).json({ deviceId: updated.deviceId, power: updated.power, lastUpdated: updated.lastUpdated });
  } catch (error) {
    next(error);
  }
});

router.post('/devices/:deviceId/mute', (req, res, next) => {
  res.locals.routePath = '/video/devices/:deviceId/mute';
  try {
    const { deviceId } = req.params;
    const payload = muteSchema.parse(req.body);
    const updated = setDeviceMute(deviceId, payload.mute);
    res.status(202).json({ deviceId: updated.deviceId, mute: updated.mute, lastUpdated: updated.lastUpdated });
  } catch (error) {
    next(error);
  }
});

router.post('/devices/:deviceId/input', (req, res, next) => {
  res.locals.routePath = '/video/devices/:deviceId/input';
  try {
    const { deviceId } = req.params;
    const payload = inputSchema.parse(req.body);
    const updated = setDeviceInput(deviceId, payload.input);
    res.status(202).json({ deviceId: updated.deviceId, input: updated.input, lastUpdated: updated.lastUpdated });
  } catch (error) {
    next(error);
  }
});

router.get('/recordings', (_req, res) => {
  res.locals.routePath = '/video/recordings';
  const recordings = listRecordingSegments();
  res.json({ items: recordings, total: recordings.length, generatedAt: new Date().toISOString() });
});

router.post('/recordings/:recordingId/export', (req, res, next) => {
  res.locals.routePath = '/video/recordings/:recordingId/export';
  try {
    const { recordingId } = req.params;
    const payload = clipExportSchema.parse(req.body);
    const result = createClipExport(recordingId, payload);
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/preview', (req, res, next) => {
  res.locals.routePath = '/video/preview';
  try {
    const payload = previewSchema.parse(req.body ?? {});
    const session = requestPreviewSession(payload.deviceId);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

export const videoRouter = router;
