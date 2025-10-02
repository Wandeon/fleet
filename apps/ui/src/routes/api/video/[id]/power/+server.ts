import type { RequestHandler } from './$types';
import { proxyFleetRequest } from '$lib/server/proxy';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
  const { id } = event.params;
  const body = await event.request.json().catch(() => ({}));
  const power = body.power ?? 'on'; // Toggle: 'on' or 'standby'

  return proxyFleetRequest(
    event,
    `/video/devices/${id}/power`,
    async () => ({
      deviceId: id,
      power,
      correlationId: event.locals.requestId,
      updatedAt: new Date().toISOString()
    }),
    { forceLive: true }
  );
};
