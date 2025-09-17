import { Router } from 'express';
import { getDevice, readDevices } from '../utils/deviceRegistry.js';
import { callDeviceEndpoint, ensureKind } from '../utils/deviceHttp.js';

const router = Router();

function isCamera(device) {
  return ensureKind(device, ['camera']);
}

function findCameraDevice(id) {
  const device = getDevice(id);
  if (!device) return null;
  if (!isCamera(device)) return null;
  return device;
}

function defaultCameraDevice() {
  return readDevices().find((device) => isCamera(device)) || null;
}

function sendProxy(res, deviceId, result, overrideData) {
  const data = overrideData !== undefined ? overrideData : result.data;
  res.status(result.status).json({
    ok: result.ok,
    status: result.status,
    device: deviceId,
    data,
  });
}

function proxyError(res, error, code) {
  const detail = error instanceof Error ? error.message : String(error);
  const status = detail === 'device_url_unset' ? 400 : 502;
  res.status(status).json({ error: code, detail });
}

router.get('/devices/:deviceId/health', async (req, res) => {
  const { deviceId } = req.params;
  const device = findCameraDevice(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const url = device.api?.health_url;
  if (!url) {
    return res.status(400).json({ error: 'health_unavailable' });
  }
  try {
    const result = await callDeviceEndpoint(device, {
      url,
      method: 'GET',
      accept: 'text/plain, application/json;q=0.8',
    });
    sendProxy(res, deviceId, result);
  } catch (err) {
    proxyError(res, err, 'camera_health_failed');
  }
});

router.get('/devices/:deviceId/stream', (req, res) => {
  const { deviceId } = req.params;
  const device = findCameraDevice(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const endpoints = Array.isArray(device.endpoints) ? device.endpoints : [];
  const findEndpoint = (needle) =>
    endpoints.find((entry) => entry?.label && entry.label.toLowerCase().includes(needle));
  const hls = findEndpoint('hls')?.url || null;
  const rtsp = findEndpoint('rtsp')?.url || null;
  const stream = {
    device: deviceId,
    base_url: device.api?.base_url || null,
    hls,
    rtsp,
    endpoints,
  };
  res.json({ ok: true, stream });
});

router.post('/devices/:deviceId/snapshot', async (req, res) => {
  const { deviceId } = req.params;
  const device = findCameraDevice(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    const result = await callDeviceEndpoint(device, {
      path: '/snapshot',
      method: 'POST',
      body: payload,
    });
    sendProxy(res, deviceId, result);
  } catch (err) {
    proxyError(res, err, 'camera_snapshot_failed');
  }
});

router.post('/devices/:deviceId/recording', async (req, res) => {
  const { deviceId } = req.params;
  const device = findCameraDevice(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const body = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : null;
  if (!action || (action !== 'start' && action !== 'stop')) {
    return res.status(400).json({ error: 'invalid_action', detail: 'Provide action start or stop.' });
  }
  try {
    const result = await callDeviceEndpoint(device, {
      path: '/recording',
      method: 'POST',
      body,
    });
    sendProxy(res, deviceId, result);
  } catch (err) {
    proxyError(res, err, 'camera_recording_failed');
  }
});

router.get('/events', async (req, res) => {
  const { deviceId, limit, since, until, type } = req.query;
  const targetDevice = deviceId ? findCameraDevice(deviceId) : defaultCameraDevice();
  if (!targetDevice) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const params = new URLSearchParams();
  if (limit !== undefined) params.set('limit', limit);
  if (since !== undefined) params.set('since', since);
  if (until !== undefined) params.set('until', until);
  if (type !== undefined) params.set('type', type);
  const query = params.toString();
  const path = query ? `/events?${query}` : '/events';
  try {
    const result = await callDeviceEndpoint(targetDevice, {
      path,
      method: 'GET',
    });
    sendProxy(res, targetDevice.id, result);
  } catch (err) {
    proxyError(res, err, 'camera_events_failed');
  }
});

export default router;
