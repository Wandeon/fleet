import axios from 'axios';
import { prisma } from '../lib/db.js';
import { upsertDeviceState } from '../services/devices.js';
import { metrics } from '../observability/metrics.js';
import {
  joinDeviceUrl,
  normalizeAddress,
  resolveBearerToken,
  resolveHealthPaths,
  resolveStatusPath,
} from '../lib/device-address.js';
import { parseJsonOr } from '../lib/json.js';

type HealthResult = {
  ok: boolean;
  path?: string;
  attempted: string[];
  data?: unknown;
  error?: unknown;
  at: string;
};

type StatusResult = {
  ok: boolean;
  path: string;
  data?: unknown;
  error?: unknown;
  at: string;
};

function serializeError(error: unknown) {
  if (axios.isAxiosError(error)) {
    return {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
    };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return error ? { message: String(error) } : null;
}

async function checkHealth(
  baseUrl: string,
  headers: Record<string, string>,
  paths: string[],
): Promise<HealthResult> {
  const attempted: string[] = [];
  let lastError: unknown;
  for (const path of paths) {
    attempted.push(path);
    try {
      const response = await axios.get(joinDeviceUrl(baseUrl, path), {
        headers,
        timeout: 3000,
      });
      const ok = response.data?.ok !== false;
      return {
        ok,
        path,
        attempted,
        data: response.data,
        at: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ok: false,
    attempted,
    error: lastError,
    at: new Date().toISOString(),
  };
}

async function fetchStatus(
  baseUrl: string,
  headers: Record<string, string>,
  path: string,
): Promise<StatusResult> {
  const url = joinDeviceUrl(baseUrl, path);
  try {
    const response = await axios.get(url, { headers, timeout: 3000 });
    return {
      ok: true,
      path,
      data: response.data,
      at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      path,
      error,
      at: new Date().toISOString(),
    };
  }
}

export async function pollOnce() {
  const devices = await prisma.device.findMany({ where: { managed: true } });
  await Promise.all(
    devices.map(async (device) => {
      const address = normalizeAddress(parseJsonOr<Record<string, unknown>>(device.address, {}));
      const baseUrl = address.baseUrl;
      if (!baseUrl) return;

      const token = resolveBearerToken(address);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [health, status] = await Promise.all([
        checkHealth(baseUrl, headers, resolveHealthPaths(address)),
        fetchStatus(baseUrl, headers, resolveStatusPath(address)),
      ]);

      const patch: Record<string, unknown> = {
        status: health.ok ? 'online' : 'offline',
        lastHealth: health.ok ? 'ok' : 'fail',
        poller: {
          health: {
            ok: health.ok,
            at: health.at,
            path: health.path ?? health.attempted[health.attempted.length - 1],
            attempted: health.attempted,
            data: health.data ?? null,
            error: health.error ? serializeError(health.error) : null,
          },
          status: {
            ok: status.ok,
            at: status.at,
            path: status.path,
            error: status.error ? serializeError(status.error) : null,
          },
        },
      };

      if (health.ok) {
        patch.lastSeen = health.at;
        metrics.circuit_breaker_state.set({ deviceId: device.id }, 0);
      }

      if (status.ok && status.data !== undefined) {
        patch.snapshot = status.data;
      }

      if (!health.ok) {
        const reason = axios.isAxiosError(health.error)
          ? health.error.code || String(health.error.response?.status || 'axios')
          : health.error instanceof Error
            ? health.error.name || 'error'
            : 'health_probe';
        metrics.upstream_device_failures_total.labels(device.id, reason).inc();
        metrics.circuit_breaker_state.set({ deviceId: device.id }, 1);
      }

      await upsertDeviceState(device.id, patch);
    }),
  );
}
