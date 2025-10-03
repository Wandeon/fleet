import type { RequestHandler } from './$types';
import { proxyFleetRequest } from '$lib/server/proxy';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
  const { id } = event.params;

  // The backend expects cameraId in the request body
  const requestBody = JSON.stringify({ cameraId: id });

  // Create a new event with the modified body
  const modifiedEvent = {
    ...event,
    request: new Request(event.request.url, {
      method: 'POST',
      headers: event.request.headers,
      body: requestBody,
    }),
  };

  return proxyFleetRequest(
    modifiedEvent as typeof event,
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
