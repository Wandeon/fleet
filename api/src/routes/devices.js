import { Router } from 'express';
import {
  readDevices,
  getDevice,
  buildAuthHeaders,
} from '../utils/deviceRegistry.js';
import { fetchWithTimeout, parseResponseContent } from '../utils/http.js';

const r = Router();

r.get('/', (_req, res) => {
  res.json(readDevices());
});

r.get('/:id', (req, res) => {
  const device = getDevice(req.params.id);
  if (!device) return res.status(404).json({ error: 'not_found' });
  res.json(device);
});

r.get('/:id/status', async (req, res) => {
  const device = getDevice(req.params.id);
  if (!device) return res.status(404).json({ error: 'not_found' });
  const url = device?.api?.status_url;
  if (!url) return res.status(400).json({ error: 'status_unavailable' });

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.8',
        ...buildAuthHeaders(device),
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
    const detail = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: 'status_fetch_failed', detail });
  }
});

export default r;
