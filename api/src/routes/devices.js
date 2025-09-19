import { Router } from 'express';
import {
  listDevices,
  getDevice,
  getDeviceState,
} from '../services/deviceService.js';
import {
  getDeviceStatusUrl,
  buildDeviceAuthHeaders,
} from '../utils/deviceAddress.js';
import { fetchWithTimeout, parseResponseContent } from '../utils/http.js';
import { NotFoundError } from '../utils/errors.js';

const r = Router();

r.get('/', async (_req, res, next) => {
  try {
    const devices = await listDevices();
    res.json({ devices });
  } catch (err) {
    next(err);
  }
});

r.get('/:id', async (req, res, next) => {
  try {
    const device = await getDevice(req.params.id);
    res.json(device);
  } catch (err) {
    next(err);
  }
});

r.get('/:id/state', async (req, res, next) => {
  try {
    const state = await getDeviceState(req.params.id);
    res.json(state);
  } catch (err) {
    next(err);
  }
});

r.get('/:id/status', async (req, res, next) => {
  try {
    const device = await getDevice(req.params.id);
    const url = getDeviceStatusUrl(device);
    if (!url) throw new NotFoundError('status endpoint unavailable for device');
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.8',
        ...buildDeviceAuthHeaders(device),
      },
      timeout: 4000,
    });
    const payload = await parseResponseContent(response);
    res.status(response.status).json({
      ok: response.ok,
      status: response.status,
      data: payload,
    });
  } catch (err) {
    next(err);
  }
});

export default r;
