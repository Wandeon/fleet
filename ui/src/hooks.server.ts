import type { Handle } from '@sveltejs/kit';
export const handle: Handle = async ({ event, resolve }) => {
  const nonce = event.request.headers.get('x-nonce') ?? cryptoRandom();
  (event as any).locals.nonce = nonce;
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%sveltekit.nonce%', nonce)
  });
};
function cryptoRandom(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }

