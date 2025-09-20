export interface DeviceAddress {
  baseUrl?: string;
  healthPath?: string;
  statusPath?: string;
  metricsPath?: string;
  token?: string;
  tokenEnv?: string;
  [key: string]: unknown;
}

const DEFAULT_HEALTH_PATH = '/healthz';
const DEFAULT_STATUS_PATH = '/status';
const FALLBACK_HEALTH_PATH = '/health';

function coerceString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function withLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function normalizeAddress(raw: unknown): DeviceAddress {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const baseUrl = coerceString(source.baseUrl ?? source.base_url);
  const healthPath = coerceString(source.healthPath ?? source.health_path);
  const statusPath = coerceString(source.statusPath ?? source.status_path);
  const metricsPath = coerceString(source.metricsPath ?? source.metrics_path);
  const token = coerceString(source.token);
  const tokenEnv = coerceString(source.tokenEnv ?? source.token_env);

  return {
    ...(source as Record<string, unknown>),
    baseUrl,
    healthPath,
    statusPath,
    metricsPath,
    token,
    tokenEnv,
  } as DeviceAddress;
}

export function resolveBearerToken(address: DeviceAddress): string | undefined {
  if (address.token && address.token.trim()) {
    return address.token.trim();
  }
  if (address.tokenEnv) {
    const envValue = process.env[address.tokenEnv];
    if (typeof envValue === 'string' && envValue.trim()) {
      return envValue.trim();
    }
  }
  return undefined;
}

export function resolveHealthPaths(address: DeviceAddress): string[] {
  const primary = withLeadingSlash(address.healthPath ?? DEFAULT_HEALTH_PATH);
  if (primary === FALLBACK_HEALTH_PATH) {
    return [primary];
  }
  return [primary, FALLBACK_HEALTH_PATH];
}

export function resolveStatusPath(address: DeviceAddress): string {
  return withLeadingSlash(address.statusPath ?? DEFAULT_STATUS_PATH);
}

export function resolveMetricsPath(address: DeviceAddress): string | undefined {
  if (!address.metricsPath) return undefined;
  return withLeadingSlash(address.metricsPath);
}

export function joinDeviceUrl(baseUrl: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = withLeadingSlash(path);
  return `${normalizedBase}${normalizedPath}`;
}
