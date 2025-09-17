import { Router } from 'express';
import { getDevice } from '../utils/deviceRegistry.js';
import { callDeviceEndpoint, ensureKind } from '../utils/deviceHttp.js';

const router = Router();

function findVideoDevice(id) {
  const device = getDevice(id);
  if (!device) return null;
  if (!ensureKind(device, ['video', 'hdmi-media'])) {
    return null;
  }
  return device;
}

function sendProxyResponse(res, deviceId, result, overrideData) {
  const data = overrideData !== undefined ? overrideData : result.data;
  res.status(result.status).json({
    ok: result.ok,
    status: result.status,
    device: deviceId,
    data,
  });
}

function handleProxyError(res, error, code = 'video_proxy_failed') {
  const detail = error instanceof Error ? error.message : String(error);
  const status = detail === 'device_url_unset' ? 400 : 502;
  res.status(status).json({ error: code, detail });
}

router.post('/devices/:deviceId/tv/power', async (req, res) => {
  const { deviceId } = req.params;
  const device = findVideoDevice(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'device_not_found' });
  }

  const body = req.body || {};
  let desired = body.state ?? body.value ?? body.mode;
  if (typeof desired === 'string') {
    desired = desired.trim().toLowerCase();
  } else if (desired === true) {
    desired = 'on';
  } else if (desired === false) {
    desired = 'off';
  }

  if (desired !== 'on' && desired !== 'off') {
    return res.status(400).json({ error: 'invalid_state', detail: 'state must be "on" or "off"' });
  }

  const path = desired === 'on' ? '/tv/power_on' : '/tv/power_off';
  try {
    const result = await callDeviceEndpoint(device, {
      path,
      method: 'POST',
    });
    const formatted =
      result.data && typeof result.data === 'object'
        ? { ...result.data, state: desired }
        : { state: desired, response: result.data ?? null };
    sendProxyResponse(res, deviceId, result, formatted);
  } catch (err) {
    handleProxyError(res, err, 'video_power_failed');
  }
});

router.post('/devices/:deviceId/tv/volume', async (req, res) => {
  const { deviceId } = req.params;
  const device = findVideoDevice(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const body = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  let volume = body.volume ?? body.level ?? body.percent ?? body.value;
  if (volume !== undefined) {
    const numeric = Number(volume);
    if (Number.isFinite(numeric)) {
      volume = numeric <= 1 ? numeric * 100 : numeric;
      volume = Math.max(0, Math.min(100, Math.round(volume)));
      body.volume = volume;
    } else {
      delete body.volume;
    }
  }
  if (body.volume === undefined && body.direction === undefined && body.mute === undefined) {
    return res.status(400).json({ error: 'invalid_payload', detail: 'Provide volume, direction, or mute state.' });
  }

  try {
    const result = await callDeviceEndpoint(device, {
      path: '/volume',
      method: 'POST',
      body,
    });
    sendProxyResponse(res, deviceId, result);
  } catch (err) {
    handleProxyError(res, err, 'video_volume_failed');
  }
});

router.post('/devices/:deviceId/tv/input', async (req, res) => {
  const { deviceId } = req.params;
  const device = findVideoDevice(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'device_not_found' });
  }
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    const result = await callDeviceEndpoint(device, {
      path: '/tv/input',
      method: 'POST',
      body: payload,
    });
    sendProxyResponse(res, deviceId, result);
  } catch (err) {
    handleProxyError(res, err, 'video_input_failed');
  }
});

router.get('/devices/:deviceId/health', async (req, res) => {
  const { deviceId } = req.params;
  const device = findVideoDevice(deviceId);
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
    sendProxyResponse(res, deviceId, result);
  } catch (err) {
    handleProxyError(res, err, 'video_health_failed');
  }
});

export default router;
