import type { RequestHandler } from './$types';
import { proxyFleetRequest } from '$lib/server/proxy';

export const POST: RequestHandler = async (event) => {
  const { id } = event.params;
  const body = await event.request.json().catch(() => ({}));
  const source = body.source ?? 'stream'; // Default to 'stream' or 'file'

  // Use the play endpoint to replay current source
  return proxyFleetRequest(event, `/audio/devices/${id}/play`, async () => ({
    accepted: true,
    source,
    correlationId: event.locals.requestId
  }), { forceLive: true });
};
