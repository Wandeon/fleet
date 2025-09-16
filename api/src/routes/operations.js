import { Router } from 'express';
import {
  getDevice,
  buildAuthHeaders,
  resolveDeviceUrl,
} from '../utils/deviceRegistry.js';
import { fetchWithTimeout, parseResponseContent } from '../utils/http.js';

const r = Router();

r.post('/:deviceId/:operationId', async (req, res) => {
  const { deviceId, operationId } = req.params;
  const device = getDevice(deviceId);
  if (!device) return res.status(404).json({ error: 'device_not_found' });

  const operation = device.operations.find((op) => op.id === operationId);
  if (!operation) return res.status(404).json({ error: 'operation_not_found' });

  const method = operation.method || 'POST';
  const url = resolveDeviceUrl(device, operation.path);
  if (!url) return res.status(400).json({ error: 'operation_url_unset' });

  const headers = {
    Accept: 'application/json, text/plain;q=0.8',
    ...buildAuthHeaders(device),
  };

  let body = operation.body && typeof operation.body === 'object' ? { ...operation.body } : undefined;
  const hasRequestBody = req.body && Object.keys(req.body || {}).length > 0;
  if (hasRequestBody) {
    body = { ...(body || {}), ...req.body };
  }

  const fetchOptions = { method, headers, timeout: 5000 };
  if (method !== 'GET' && method !== 'HEAD') {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = body ? JSON.stringify(body) : JSON.stringify({});
  }

  try {
    const response = await fetchWithTimeout(url, fetchOptions);
    const payload = await parseResponseContent(response);
    res.status(response.status).json({
      ok: response.ok,
      status: response.status,
      data: payload,
      device: deviceId,
      operation: operationId,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: 'operation_failed', detail, device: deviceId, operation: operationId });
  }
});

export default r;
