import { Router } from 'express';
import { readDevices } from '../utils/deviceRegistry.js';
import { fetchWithTimeout } from '../utils/http.js';

const r = Router();

async function checkDevice(device) {
  const url = device?.api?.health_url;
  if (!url) {
    return {
      id: device.id,
      name: device.name,
      role: device.role,
      status: 'UNKNOWN',
      detail: 'no health endpoint configured',
      health_url: null,
      latency_ms: null,
      status_code: null,
    };
  }

  const headers = {
    Accept: 'application/json, text/plain;q=0.8',
  };

  let status = 'UNKNOWN';
  let detail = '';
  let latencyMs = null;
  let statusCode = null;

  try {
    const started = process.hrtime.bigint();
    const response = await fetchWithTimeout(url, { method: 'GET', headers, timeout: 3500 });
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
    latencyMs = Math.round(elapsed * 10) / 10;
    statusCode = response.status;
    detail = await response.text();
    status = response.ok ? 'UP' : 'DOWN';
  } catch (err) {
    status = 'DOWN';
    detail = err instanceof Error ? err.message : String(err);
  }

  return {
    id: device.id,
    name: device.name,
    role: device.role,
    status,
    detail,
    health_url: url,
    latency_ms: latencyMs,
    status_code: statusCode,
  };
}

r.get('/', async (_req, res) => {
  const devices = readDevices();
  const checks = await Promise.all(devices.map((device) => checkDevice(device)));

  const statuses = checks.map((check) => check.status);
  let overall = 'UP';
  if (statuses.every((status) => status === 'UP')) {
    overall = 'UP';
  } else if (statuses.some((status) => status === 'UP')) {
    overall = 'DEGRADED';
  } else {
    overall = 'DOWN';
  }

  const components = {};
  for (const check of checks) {
    components[check.id] = check.status;
  }

  res.json({
    overall,
    timestamp: new Date().toISOString(),
    polling_interval: 30,
    components,
    devices: checks,
  });
});

export default r;
