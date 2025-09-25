import { mockApi } from '$lib/api/mock';
import { proxyFleetRequest } from '$lib/server/proxy';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) =>
  proxyFleetRequest(event, '/camera/events', () => mockApi.cameraEvents());
