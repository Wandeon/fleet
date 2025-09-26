import { error, json, type RequestEvent } from '@sveltejs/kit';

const API_BASE = (process.env.API_BASE_URL ?? '/api').replace(/\/$/, '');
const AUTH_TOKEN = (process.env.API_BEARER ?? '').trim();
const USE_MOCKS = (process.env.VITE_USE_MOCKS ?? '1') === '1';
const LOG_LABEL = '[ui-proxy]';

const BASE_RESPONSE_HEADERS = new Set(['cache-control', 'etag', 'last-modified']);

type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ProxyOptions {
  /** When true the request will bypass mock fallbacks even if mocks are enabled. */
  forceLive?: boolean;
  /** When true the proxy will stream the upstream body without JSON parsing. */
  stream?: boolean;
  /** Additional response headers to forward from the upstream response. */
  forwardHeaders?: string[];
}

export interface ProxyFallbackContext {
  event: RequestEvent;
  rawBody: ArrayBuffer | null;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  formData: () => Promise<FormData>;
}

type ProxyFallback = (
  context: ProxyFallbackContext
) => Promise<Response | unknown> | Response | unknown;

function resolveAuthorization(): string | null {
  if (!AUTH_TOKEN) return null;
  return AUTH_TOKEN.startsWith('Bearer ') ? AUTH_TOKEN : `Bearer ${AUTH_TOKEN}`;
}

function buildTarget(path: string): string {
  if (!API_BASE) {
    throw error(500, { message: 'Fleet API base URL not configured' });
  }

  if (API_BASE.startsWith('http://') || API_BASE.startsWith('https://')) {
    return new URL(path, `${API_BASE}/`).toString();
  }

  return `${API_BASE}${path}`;
}

function logInfo(message: string, details: Record<string, unknown>) {
  console.info(LOG_LABEL, message, details);
}

function logError(message: string, details: Record<string, unknown>) {
  console.error(LOG_LABEL, message, details);
}

async function readErrorDetail(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    if (contentType.startsWith('text/')) {
      const text = await response.text();
      return text.slice(0, 500);
    }
  } catch {
    // Swallow parsing errors and fall through to returning null below.
  }
  return null;
}

function copyAllowedHeaders(source: Headers, target: Headers, extra: string[] = []) {
  const allowed = new Set([
    ...BASE_RESPONSE_HEADERS,
    ...extra.map((header) => header.toLowerCase()),
  ]);
  for (const [key, value] of source.entries()) {
    if (allowed.has(key.toLowerCase())) {
      target.set(key, value);
    }
  }
}

export async function proxyFleetRequest(
  event: RequestEvent,
  path: string,
  fallback: ProxyFallback,
  options: ProxyOptions = {}
): Promise<Response> {
  const method = (event.request.method?.toUpperCase() ?? 'GET') as HttpMethod;
  const targetPath = path.startsWith('/') ? path : `/${path}`;
  const startedAt = Date.now();
  const requestId = event.locals.requestId;
  const usingMocks = USE_MOCKS && !options.forceLive;

  let rawBody: ArrayBuffer | null = null;
  if (!['GET', 'HEAD'].includes(method)) {
    rawBody = await event.request.clone().arrayBuffer();
  }

  const context: ProxyFallbackContext = {
    event,
    rawBody,
    json: async () => {
      if (!rawBody) return null;
      const text = new TextDecoder().decode(rawBody);
      return text ? JSON.parse(text) : null;
    },
    text: async () => {
      if (!rawBody) return '';
      return new TextDecoder().decode(rawBody);
    },
    formData: async () => {
      if (rawBody === null && ['GET', 'HEAD'].includes(method)) {
        return new FormData();
      }
      return event.request.clone().formData();
    },
  };

  const respondWithMock = async () => {
    const mock = await fallback(context);
    if (mock instanceof Response) {
      const response = mock;
      response.headers.set('cache-control', response.headers.get('cache-control') ?? 'no-store');
      logInfo(`${method} ${targetPath} -> ${response.status}`, {
        requestId,
        source: 'mock',
        durationMs: Date.now() - startedAt,
      });
      return response;
    }
    const response = json(mock ?? {}, { status: 200 });
    response.headers.set('cache-control', 'no-store');
    logInfo(`${method} ${targetPath} -> 200`, {
      requestId,
      source: 'mock',
      durationMs: Date.now() - startedAt,
    });
    return response;
  };

  if (usingMocks) {
    return respondWithMock();
  }

  const target = buildTarget(targetPath);
  const headers = new Headers({ Accept: 'application/json' });
  const originalContentType = event.request.headers.get('content-type');
  if (originalContentType) {
    headers.set('content-type', originalContentType);
  }
  const auth = resolveAuthorization();
  if (auth) headers.set('Authorization', auth);
  if (event.locals.requestId) {
    headers.set('x-correlation-id', event.locals.requestId);
  }

  let upstream: Response;
  try {
    upstream = await event.fetch(target, {
      method,
      headers,
      body: rawBody ? rawBody.slice(0) : undefined,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logError(`${method} ${targetPath} -> upstream request failed`, {
      requestId,
      detail,
    });
    return respondWithMock();
  }

  if (!upstream.ok) {
    const detail = await readErrorDetail(upstream.clone());
    const detailMessage =
      typeof detail === 'string' ? detail : detail != null ? JSON.stringify(detail) : undefined;
    logError(`${method} ${targetPath} -> ${upstream.status}`, {
      requestId,
      detail: detailMessage,
    });
    try {
      return await respondWithMock();
    } catch {
      throw error(upstream.status, detailMessage ?? 'Upstream request failed');
    }
  }

  let response: Response;
  if (options.stream) {
    response = new Response(upstream.body, {
      status: upstream.status,
      headers: new Headers(),
    });
    copyAllowedHeaders(upstream.headers, response.headers, [
      ...(options.forwardHeaders ?? []),
      'content-type',
    ]);
  } else {
    const payload = await upstream.json();
    response = json(payload, { status: upstream.status });
    copyAllowedHeaders(upstream.headers, response.headers, options.forwardHeaders);
    if (!response.headers.has('cache-control')) {
      response.headers.set('cache-control', 'no-store');
    }
  }
  logInfo(`${method} ${targetPath} -> ${upstream.status}`, {
    requestId,
    durationMs: Date.now() - startedAt,
    target,
  });
  return response;
}
