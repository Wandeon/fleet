import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { muted } = await request.json();

    if (typeof muted !== 'boolean') {
      return json({ error: 'Invalid mute state' }, { status: 400 });
    }

    // For now, just return success - mute control would need to be implemented in device shim
    return json({ success: true, muted });
  } catch (error) {
    console.error('Video mute control error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
