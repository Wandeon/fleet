import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

const ROOT = path.resolve(process.cwd(), '..');
const DEVICES_FILE = process.env.DEVICES_FILE || path.join(ROOT, 'inventory/devices.yaml');
const INTERFACES_FILE =
  process.env.DEVICE_INTERFACES_FILE || path.join(ROOT, 'inventory/device-interfaces.yaml');

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    return null;
  }
}

function parseYaml(file) {
  const txt = safeRead(file);
  if (!txt) return null;
  try {
    return YAML.parse(txt);
  } catch (err) {
    return null;
  }
}

function readDeviceRoles() {
  const doc = parseYaml(DEVICES_FILE);
  const out = {};
  if (doc && doc.devices && typeof doc.devices === 'object') {
    for (const [id, value] of Object.entries(doc.devices)) {
      if (typeof value === 'string') {
        out[id] = { role: value };
      } else if (value && typeof value === 'object' && value.role) {
        out[id] = { role: value.role };
      }
    }
  }
  return out;
}

function combineUrl(base, suffix) {
  if (!base) return null;
  if (!suffix) return base;
  if (suffix.startsWith('http://') || suffix.startsWith('https://')) {
    return suffix;
  }
  const needsSlash = !base.endsWith('/') && !suffix.startsWith('/');
  if (base.endsWith('/') && suffix.startsWith('/')) {
    return `${base}${suffix.slice(1)}`;
  }
  return needsSlash ? `${base}/${suffix}` : `${base}${suffix}`;
}

function normalizeOperation(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const method = (entry.method || 'POST').toString().toUpperCase();
  const ui = entry.ui && typeof entry.ui === 'object' ? { ...entry.ui } : {};
  const body = entry.body && typeof entry.body === 'object' ? { ...entry.body } : null;
  return {
    id: entry.id,
    label: entry.label || entry.id || 'operation',
    method,
    path: entry.path || '/',
    body,
    ui,
  };
}

function normalizeDevice(raw, roles) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id;
  if (!id) return null;
  const name = raw.name || id;
  const role = raw.role || (roles[id] ? roles[id].role : null) || null;
  const kind = raw.kind || role || 'device';
  const management = raw.management && typeof raw.management === 'object' ? { ...raw.management } : {};

  const apiRaw = raw.api && typeof raw.api === 'object' ? raw.api : {};
  const baseUrl = apiRaw.base_url || null;
  const healthPath = apiRaw.health_path || '/healthz';
  const statusPath = apiRaw.status_path || '/status';
  const metricsPath = apiRaw.metrics_path || '/metrics';
  const auth = apiRaw.auth && typeof apiRaw.auth === 'object' ? { ...apiRaw.auth } : null;
  const api = {
    base_url: baseUrl,
    health_path: healthPath,
    status_path: statusPath,
    metrics_path: metricsPath,
    health_url: combineUrl(baseUrl, healthPath),
    status_url: combineUrl(baseUrl, statusPath),
    metrics_url: combineUrl(baseUrl, metricsPath),
    auth,
  };

  const endpoints = Array.isArray(raw.endpoints)
    ? raw.endpoints.map((item) => ({ ...item }))
    : [];

  const monitoringRaw = raw.monitoring && typeof raw.monitoring === 'object' ? raw.monitoring : {};
  const prometheusTargets = Array.isArray(monitoringRaw.prometheus_targets)
    ? monitoringRaw.prometheus_targets
        .filter((target) => target && target.job && target.target)
        .map((target) => ({ job: target.job, target: target.target }))
    : [];
  const monitoring = { prometheus_targets: prometheusTargets };

  const operations = Array.isArray(raw.operations)
    ? raw.operations
        .map((op) => normalizeOperation(op))
        .filter((op) => op && op.id)
    : [];

  return {
    id,
    name,
    role,
    kind,
    management,
    api,
    endpoints,
    monitoring,
    operations,
  };
}

export function readDevices() {
  const roles = readDeviceRoles();
  const doc = parseYaml(INTERFACES_FILE);
  if (!doc || !Array.isArray(doc.devices)) return [];
  const devices = [];
  for (const entry of doc.devices) {
    const normalized = normalizeDevice(entry, roles);
    if (normalized) devices.push(normalized);
  }
  return devices;
}

export function getDevice(id) {
  return readDevices().find((device) => device.id === id);
}

export function resolveDeviceUrl(device, pathSuffix) {
  if (!device || !device.api) return null;
  return combineUrl(device.api.base_url, pathSuffix);
}

export function buildAuthHeaders(device) {
  const headers = {};
  const auth = device && device.api ? device.api.auth : null;
  if (auth && auth.type === 'bearer' && auth.token_env) {
    const token = process.env[auth.token_env];
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export { readDeviceRoles };
