import type { RequestHandler } from './$types';
import { mockApi } from '$lib/api/mock';
import { proxyFleetRequest } from '$lib/server/proxy';

export const GET: RequestHandler = (event) => proxyFleetRequest(event, '/fleet/layout', () => mockApi.layout());

