import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { volume } = await request.json();

    if (typeof volume !== 'number' || volume < 0 || volume > 100) {
      return json({ error: 'Invalid volume level' }, { status: 400 });
    }

    // For now, just return success - volume control would need to be implemented in device shim
    return json({ success: true, volume });
  } catch (error) {
    console.error('Video volume control error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};