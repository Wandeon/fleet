import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { source } = await request.json();

    if (!source || !['HDMI1', 'HDMI2', 'AV'].includes(source)) {
      return json({ error: 'Invalid input source' }, { status: 400 });
    }

    // Mock API call to video device - replace with actual device communication
    const response = await fetch('http://pi-video-01:8082/input', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-video-01-token' // Replace with actual token from env
      },
      body: JSON.stringify({ source })
    });

    if (response.ok) {
      const result = await response.json();
      return json({ success: true, input: result.input });
    } else {
      return json({ error: 'Device input control failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Video input control error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};