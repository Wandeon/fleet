export function getDeviceBaseUrl(device) {
  return device?.address?.api?.base_url || device?.api?.base_url || null;
}

export function getDeviceStatusUrl(device) {
  const base = getDeviceBaseUrl(device);
  const statusPath = device?.address?.api?.status_path || device?.api?.status_path || '/status';
  if (!base) return null;
  return joinUrl(base, statusPath);
}

export function getDeviceHealthUrl(device) {
  const base = getDeviceBaseUrl(device);
  const healthPath = device?.address?.api?.health_path || device?.api?.health_path || '/healthz';
  if (!base) return null;
  return joinUrl(base, healthPath);
}

export function getDeviceMetricsUrl(device) {
  const base = getDeviceBaseUrl(device);
  const metricsPath = device?.address?.api?.metrics_path || device?.api?.metrics_path || '/metrics';
  if (!base) return null;
  return joinUrl(base, metricsPath);
}

export function buildDeviceAuthHeaders(device) {
  const headers = {};
  const auth = device?.address?.api?.auth || device?.api?.auth;
  if (auth?.type === 'bearer' && auth?.token_env) {
    const token = process.env[auth.token_env];
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function joinUrl(base, suffix) {
  if (!suffix) return base;
  if (suffix.startsWith('http://') || suffix.startsWith('https://')) return suffix;
  const needsSlash = !base.endsWith('/') && !suffix.startsWith('/');
  if (base.endsWith('/') && suffix.startsWith('/')) return `${base}${suffix.slice(1)}`;
  return needsSlash ? `${base}/${suffix}` : `${base}${suffix}`;
}
