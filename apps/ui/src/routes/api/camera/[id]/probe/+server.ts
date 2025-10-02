import type { RequestHandler } from './$types';
import { proxyFleetRequest } from '$lib/server/proxy';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
  const { id } = event.params;

  return proxyFleetRequest(
    event,
    `/camera/probe`,
    async () => ({
      cameraId: id,
      status: 'unavailable',
      probedAt: new Date().toISOString(),
      correlationId: event.locals.requestId,
      reason: 'Camera probe not yet implemented'
    }),
    { forceLive: true }
  );
};
