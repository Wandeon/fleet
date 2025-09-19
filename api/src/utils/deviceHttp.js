import { getDeviceBaseUrl, buildDeviceAuthHeaders } from './deviceAddress.js';
import { fetchWithTimeout, parseResponseContent } from './http.js';

function ensureDevice(device) {
  if (!device) {
    throw new Error('device_required');
  }
}

function buildHeaders(device, headers = {}, accept) {
  const baseHeaders = accept ? { Accept: accept } : { Accept: 'application/json, text/plain;q=0.8' };
  return {
    ...baseHeaders,
    ...buildDeviceAuthHeaders(device),
    ...headers,
  };
}

export async function callDeviceEndpoint(device, options = {}) {
  ensureDevice(device);
  const {
    path,
    url,
    method = 'GET',
    body,
    headers = {},
    timeout = 5000,
    accept,
    parse = true,
  } = options;

  const targetUrl = url || resolveDeviceUrl(device, path);
  if (!targetUrl) {
    throw new Error('device_url_unset');
  }

  const requestHeaders = buildHeaders(device, headers, accept);
  const fetchOptions = { method, headers: requestHeaders, timeout };

  const upperMethod = method.toUpperCase();
  if (upperMethod !== 'GET' && upperMethod !== 'HEAD') {
    if (body === undefined || body === null) {
      if (!requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
      }
      if (requestHeaders['Content-Type'].includes('json')) {
        fetchOptions.body = '{}';
      } else {
        fetchOptions.body = '';
      }
    } else if (typeof body === 'string' || (typeof Buffer !== 'undefined' && Buffer.isBuffer(body))) {
      fetchOptions.body = body;
    } else {
      if (!requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
      }
      fetchOptions.body = JSON.stringify(body);
    }
  }

  const response = await fetchWithTimeout(targetUrl, fetchOptions);
  const data = parse ? await parseResponseContent(response) : null;

  return {
    ok: response.ok,
    status: response.status,
    data,
    headers: Object.fromEntries(response.headers.entries()),
    url: targetUrl,
  };
}

function resolveDeviceUrl(device, pathSuffix) {
  const base = getDeviceBaseUrl(device);
  if (!base) return null;
  if (!pathSuffix) return base;
  if (pathSuffix.startsWith('http://') || pathSuffix.startsWith('https://')) return pathSuffix;
  const needsSlash = !base.endsWith('/') && !pathSuffix.startsWith('/');
  if (base.endsWith('/') && pathSuffix.startsWith('/')) return `${base}${pathSuffix.slice(1)}`;
  return needsSlash ? `${base}/${pathSuffix}` : `${base}${pathSuffix}`;
}

export function ensureKind(device, kinds = []) {
  if (!device) {
    return false;
  }
  if (!Array.isArray(kinds) || kinds.length === 0) {
    return true;
  }
  return kinds.some((kind) => device.kind === kind || device.role === kind);
}
