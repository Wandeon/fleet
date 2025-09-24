import { error, json, type RequestEvent } from '@sveltejs/kit';

const API_BASE = (process.env.FLEET_API_BASE ?? process.env.API_BASE ?? process.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const AUTH_TOKEN = process.env.FLEET_API_BEARER ?? process.env.VITE_FLEET_API_TOKEN ?? '';
const USE_MOCKS = (process.env.VITE_USE_MOCKS ?? '1') === '1';

const FORWARDED_RESPONSE_HEADERS = new Set(['cache-control', 'etag', 'last-modified']);

function resolveAuthorization(): string | null {
  if (!AUTH_TOKEN) return null;
  return AUTH_TOKEN.startsWith('Bearer ') ? AUTH_TOKEN : `Bearer ${AUTH_TOKEN}`;
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

function copyAllowedHeaders(source: Headers, target: Headers) {
  for (const [key, value] of source.entries()) {
    if (FORWARDED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      target.set(key, value);
    }
  }
}

export async function proxyFleetRequest(
  event: RequestEvent,
  path: string,
  fallback: () => unknown,
): Promise<Response> {
  if (USE_MOCKS) {
    const mock = fallback();
    const response = json(mock);
    response.headers.set('cache-control', 'no-store');
    return response;
  }

  if (!API_BASE) {
    throw error(500, { message: 'Fleet API base URL not configured' });
  }

  const target = new URL(path, API_BASE).toString();
  const headers = new Headers({ Accept: 'application/json' });
  const auth = resolveAuthorization();
  if (auth) headers.set('Authorization', auth);
  if (event.locals.requestId) {
    headers.set('x-correlation-id', event.locals.requestId);
  }

  let upstream: Response;
  try {
    upstream = await event.fetch(target, { method: 'GET', headers });
  } catch (err) {
    throw error(502, { message: 'Upstream request failed', detail: String(err) });
  }

  if (!upstream.ok) {
    const detail = await readErrorDetail(upstream.clone());
    throw error(upstream.status, {
      message: 'Upstream request failed',
      detail: detail ?? undefined,
    });
  }

  const payload = await upstream.json();
  const response = json(payload, { status: upstream.status });
  copyAllowedHeaders(upstream.headers, response.headers);
  if (!response.headers.has('cache-control')) {
    response.headers.set('cache-control', 'no-store');
  }
  return response;
}

