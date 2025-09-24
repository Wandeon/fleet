import { error, type RequestHandler } from '@sveltejs/kit';
import { mockApi } from '$lib/api/mock';
import { proxyFleetRequest } from '$lib/server/proxy';

const FALLBACKS = new Map<string, () => unknown>([
  ['/fleet/state', () => mockApi.state()],
  ['/fleet/layout', () => mockApi.layout()],
  ['/audio', () => mockApi.audio()],
  ['/video', () => mockApi.video()],
  ['/zigbee', () => mockApi.zigbee()],
  ['/camera', () => mockApi.camera()],
  ['/logs', () => mockApi.logs()],
]);

const missingMock = (path: string) => () => {
  throw error(404, { message: `No mock response defined for ${path}` });
};

const normalisePath = (segment: string): string => {
  if (!segment) return '/';
  const collapsed = `/${segment}`.replace(/\/{2,}/g, '/');
  return collapsed.endsWith('/') ? collapsed.slice(0, -1) || '/' : collapsed;
};

export const GET: RequestHandler = async (event) => {
  const search = event.url.search ?? '';
  const cleanPath = normalisePath(event.params.proxy ?? '');
  const fallback = FALLBACKS.get(cleanPath) ?? missingMock(cleanPath);
  return proxyFleetRequest(event, `${cleanPath}${search}`, fallback);
};
