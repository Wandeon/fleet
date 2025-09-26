import type { Handle, HandleFetch } from '@sveltejs/kit';

function readBodyPreview(response: Response): Promise<unknown | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response
      .json()
      .then((value) => value as unknown)
      .catch(() => null);
  }
  if (contentType.startsWith('text/')) {
    return response
      .text()
      .then((value) => value.slice(0, 500))
      .catch(() => null);
  }
  return Promise.resolve(null);
}

export const handle: Handle = async ({ event, resolve }) => {
  const headerRequestId =
    event.request.headers.get('x-request-id') ?? event.request.headers.get('x-correlation-id');
  const requestId =
    headerRequestId && headerRequestId.trim() ? headerRequestId.trim() : crypto.randomUUID();
  event.locals.requestId = requestId;

  const response = await resolve(event);
  if (!response.headers.has('x-request-id')) {
    response.headers.set('x-request-id', requestId);
  }
  return response;
};

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  const response = await fetch(request);

  if (!response.ok && typeof request.url === 'string') {
    try {
      const preview = await readBodyPreview(response.clone());
      console.error('SSR fetch failed', {
        url: request.url,
        status: response.status,
        requestId: event.locals.requestId,
        detail: preview ?? undefined,
      });
    } catch (error) {
      console.error('SSR fetch logging failed', {
        url: request.url,
        requestId: event.locals.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return response;
};
