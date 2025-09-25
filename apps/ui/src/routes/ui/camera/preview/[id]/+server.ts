import { mockApi } from '$lib/api/mock';
import { proxyFleetRequest } from '$lib/server/proxy';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const id = event.params.id ?? '';
  return proxyFleetRequest(event, `/camera/preview/${id}`, () => mockApi.cameraPreview(id));
};
