import axios, { isAxiosError, type AxiosRequestConfig } from 'axios';
import { prisma } from '../lib/db.js';
import { joinDeviceUrl, normalizeAddress, resolveBearerToken } from '../lib/device-address.js';
import { log } from '../lib/logger.js';

type RawOperation = {
  id?: unknown;
  method?: unknown;
  path?: unknown;
  body?: unknown;
  headers?: unknown;
};

export type OperationResult = {
  status: number;
  ok: boolean;
  data: unknown;
  headers: Record<string, string>;
};

export class OperationError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function coerceString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function coerceHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const headers: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw == null) continue;
    headers[String(key)] = String(raw);
  }
  return headers;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mergePayload(base: unknown, override: unknown): unknown {
  const baseRecord = asRecord(base);
  const overrideRecord = asRecord(override);
  if (baseRecord && overrideRecord) {
    return { ...baseRecord, ...overrideRecord };
  }
  if (overrideRecord) return overrideRecord;
  if (baseRecord) return baseRecord;
  return override ?? base ?? null;
}

function normalizeOperations(source: unknown): RawOperation[] {
  if (!Array.isArray(source)) return [];
  return source.filter((entry) => entry && typeof entry === 'object') as RawOperation[];
}

export async function executeOperation(
  deviceId: string,
  operationId: string,
  override: unknown,
): Promise<OperationResult> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    throw new OperationError(404, `Device ${deviceId} not found`);
  }

  const address = normalizeAddress(device.address);
  const baseUrl = address.baseUrl;
  if (!baseUrl) {
    throw new OperationError(400, `Device ${deviceId} is missing a base URL`);
  }

  const capabilities = (device.capabilities ?? {}) as Record<string, unknown>;
  const operations = normalizeOperations((capabilities as any).operations);
  const operation = operations.find((entry) => coerceString(entry.id) === operationId);
  if (!operation) {
    throw new OperationError(404, `Operation ${operationId} not defined for ${deviceId}`);
  }

  const method = coerceString(operation.method)?.toUpperCase() || 'POST';
  const path = coerceString(operation.path) || '/';
  const url = joinDeviceUrl(baseUrl, path);
  const token = resolveBearerToken(address);
  const headers = coerceHeaders(operation.headers);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const payload = mergePayload(operation.body, override);
  const timeout = Number.parseInt(process.env.OPERATION_TIMEOUT_MS || '5000', 10) || 5000;

  const requestConfig: AxiosRequestConfig = {
    method,
    url,
    headers: { ...headers },
    timeout,
    validateStatus: () => true,
  };

  if (method === 'GET' || method === 'DELETE') {
    if (payload && typeof payload === 'object') {
      requestConfig.params = payload as Record<string, unknown>;
    }
  } else if (payload !== undefined) {
    if (!requestConfig.headers) requestConfig.headers = {};
    if (!requestConfig.headers['Content-Type'] && !requestConfig.headers['content-type']) {
      requestConfig.headers['Content-Type'] = 'application/json';
    }
    requestConfig.data = payload;
  }

  const attemptPayload = payload ?? null;
  await prisma.deviceEvent.create({
    data: {
      deviceId,
      eventType: 'operation.request',
      payload: { operationId, method, path, body: attemptPayload },
      origin: 'api',
    },
  });

  try {
    const response = await axios.request(requestConfig);
    const result: OperationResult = {
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      data: response.data ?? null,
      headers: Object.fromEntries(
        Object.entries(response.headers || {}).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value)]),
      ),
    };

    await prisma.deviceEvent.create({
      data: {
        deviceId,
        eventType: 'operation.response',
        payload: {
          operationId,
          status: result.status,
          ok: result.ok,
        },
        origin: 'device',
      },
    });

    log.debug({ deviceId, operationId, status: result.status }, 'Operation executed');
    return result;
  } catch (error) {
    if (isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const data = error.response?.data ?? { message: error.message };
      await prisma.deviceEvent.create({
        data: {
          deviceId,
          eventType: 'operation.error',
          payload: {
            operationId,
            status,
            message: error.message,
            data,
          },
          origin: 'device',
        },
      });
      log.warn({ deviceId, operationId, status, err: error.message }, 'Operation failed');
      throw new OperationError(status, error.message || 'Operation failed', data);
    }

    const message = error instanceof Error ? error.message : 'Operation failed';
    await prisma.deviceEvent.create({
      data: {
        deviceId,
        eventType: 'operation.error',
        payload: {
          operationId,
          message,
        },
        origin: 'device',
      },
    });
    log.error({ deviceId, operationId, err: message }, 'Operation failed');
    throw new OperationError(500, message);
  }
}
