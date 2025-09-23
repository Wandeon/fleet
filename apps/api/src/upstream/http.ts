import { setTimeout as delay } from 'node:timers/promises';
import { config } from '../config';
import { logger } from '../middleware/logging';
import {
  HttpError,
  createHttpError,
  mapUpstreamError,
  type UpstreamFailureReason
} from '../util/errors';
import { recordUpstreamFailure, setCircuitBreakerState } from '../observability/metrics';
import type { Device } from './devices';

const circuits = new Map<string, { failures: number; openedAt?: number }>();

const FAILURE_THRESHOLD = config.CIRCUIT_FAILURE_THRESHOLD;
const OPEN_MILLIS = config.CIRCUIT_OPEN_MS;

function getCircuit(deviceId: string) {
  let circuit = circuits.get(deviceId);
  if (!circuit) {
    circuit = { failures: 0 };
    circuits.set(deviceId, circuit);
  }
  return circuit;
}

function isCircuitOpen(deviceId: string): boolean {
  const circuit = getCircuit(deviceId);
  if (!circuit.openedAt) {
    return false;
  }

  if (Date.now() - circuit.openedAt >= OPEN_MILLIS) {
    circuit.openedAt = undefined;
    circuit.failures = 0;
    setCircuitBreakerState(deviceId, false);
    return false;
  }

  return true;
}

function recordFailure(deviceId: string, reason: UpstreamFailureReason): void {
  const circuit = getCircuit(deviceId);
  circuit.failures += 1;
  recordUpstreamFailure(deviceId, reason);

  if (!circuit.openedAt && circuit.failures >= FAILURE_THRESHOLD) {
    circuit.openedAt = Date.now();
    setCircuitBreakerState(deviceId, true);
    logger.warn({
      msg: 'circuit_open',
      deviceId,
      failures: circuit.failures
    });
  }
}

function recordSuccess(deviceId: string): void {
  const circuit = getCircuit(deviceId);
  if (circuit.failures > 0 || circuit.openedAt) {
    logger.debug({ msg: 'circuit_reset', deviceId, failures: circuit.failures });
  }
  circuit.failures = 0;
  circuit.openedAt = undefined;
  setCircuitBreakerState(deviceId, false);
}

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string | undefined>;
  body?: BodyInit | null;
  timeoutMs?: number;
  correlationId?: string;
  idempotent?: boolean;
  expectedStatus?: number[];
}

function buildHeaders(
  device: Device,
  options: HttpRequestOptions
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json'
  };

  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      if (value !== undefined) {
        headers[key] = value;
      }
    }
  }

  if (device.authToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${device.authToken}`;
  }

  if (options.correlationId) {
    headers['x-correlation-id'] = options.correlationId;
  }

  return headers;
}

async function delayWithBackoff(attempt: number): Promise<void> {
  if (attempt <= 0) {
    return;
  }
  const base = config.RETRY_BACKOFF_MS * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * config.RETRY_BACKOFF_MS);
  await delay(base + jitter);
}

function handleHttpError(device: Device, response: Response, body: string): HttpError {
  if (response.status === 409) {
    return createHttpError(409, 'conflict', `Device ${device.id} reported a conflict`, {
      details: { body }
    });
  }

  if (response.status >= 500) {
    return createHttpError(502, 'upstream_error', `Device ${device.id} returned ${response.status}`, {
      details: { body }
    });
  }

  if (response.status === 404) {
    return createHttpError(502, 'upstream_error', `Device ${device.id} endpoint not found`, {
      details: { body }
    });
  }

  return createHttpError(502, 'upstream_error', `Unexpected response from device ${device.id}`, {
    details: { body, status: response.status }
  });
}

export async function httpRequest(
  device: Device,
  path: string,
  options: HttpRequestOptions = {}
): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const timeoutMs = options.timeoutMs ?? config.TIMEOUT_MS;
  const idempotent = options.idempotent ?? method === 'GET';
  const attempts = idempotent ? config.RETRY_MAX + 1 : 1;

  const url = new URL(path, device.baseUrl).toString();

  if (isCircuitOpen(device.id)) {
    recordFailure(device.id, 'circuit_open');
    throw Object.assign(createHttpError(503, 'circuit_open', `Circuit open for device ${device.id}`), {
      reason: 'circuit_open' as UpstreamFailureReason
    });
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    const headers = buildHeaders(device, options);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body,
        signal: controller.signal
      });

      clearTimeout(timer);

      if (options.expectedStatus && !options.expectedStatus.includes(response.status)) {
        const text = await response.text();
        const httpError = handleHttpError(device, response, text);
        recordFailure(device.id, 'http');
        if (idempotent && response.status >= 500 && attempt < attempts - 1) {
          await delayWithBackoff(attempt + 1);
          continue;
        }
        throw httpError;
      }

      if (response.status >= 400) {
        const text = await response.text();
        const httpError = handleHttpError(device, response, text);
        recordFailure(device.id, 'http');
        if (idempotent && response.status >= 500 && attempt < attempts - 1) {
          await delayWithBackoff(attempt + 1);
          continue;
        }
        throw httpError;
      }

      recordSuccess(device.id);
      return response;
    } catch (error) {
      clearTimeout(timer);
      const upstreamError = mapUpstreamError(error, {
        deviceId: device.id,
        operation: `${method} ${path}`
      });

      recordFailure(device.id, upstreamError.reason);

      if (idempotent && attempt < attempts - 1 && upstreamError.status >= 500) {
        await delayWithBackoff(attempt + 1);
        continue;
      }

      throw upstreamError;
    }
  }

  throw createHttpError(502, 'upstream_error', `Device ${device.id} failed after retries`);
}

export async function httpRequestJson<T = unknown>(
  device: Device,
  path: string,
  options: HttpRequestOptions = {}
): Promise<T> {
  const headers: Record<string, string | undefined> = {
    ...(options.headers ?? {})
  };
  if (options.body && !headers?.['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await httpRequest(device, path, {
    ...options,
    headers
  });

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw createHttpError(502, 'upstream_error', `Failed to parse JSON from device ${device.id}`, { cause: error });
  }
}

export function resetCircuitBreakers(): void {
  circuits.clear();
}
