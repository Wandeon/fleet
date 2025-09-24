import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { state } = await request.json();

    if (!state || !['on', 'off'].includes(state)) {
      return json({ error: 'Invalid power state' }, { status: 400 });
    }

    // Mock API call to video device - replace with actual device communication
    const response = await fetch('http://pi-video-01:8082/power', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-video-01-token' // Replace with actual token from env
      },
      body: JSON.stringify({ state })
    });

    if (response.ok) {
      const result = await response.json();
      return json({ success: true, power: result.power });
    } else {
      return json({ error: 'Device power control failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Video power control error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};