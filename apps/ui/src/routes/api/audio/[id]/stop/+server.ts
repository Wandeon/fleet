import type { RequestHandler } from './$types';
import { proxyFleetRequest } from '$lib/server/proxy';

export const POST: RequestHandler = async (event) => {
  const { id } = event.params;
  return proxyFleetRequest(event, `/audio/devices/${id}/stop`, async () => ({
    accepted: true,
    correlationId: event.locals.requestId
  }), { forceLive: true });
};
