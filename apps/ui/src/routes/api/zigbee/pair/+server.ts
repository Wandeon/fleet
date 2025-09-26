import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { enable } = await request.json();

    if (typeof enable !== 'boolean') {
      return json({ error: 'Invalid enable parameter' }, { status: 400 });
    }

    // Mock API call to Zigbee coordinator - replace with actual device communication
    const response = await fetch('http://pi-zigbee-01:8084/pair', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-zigbee-01-token', // Replace with actual token from env
      },
      body: JSON.stringify({ enable, timeout: 60 }),
    });

    if (response.ok) {
      const result = await response.json();
      return json({ success: true, pairing: enable, timeout: result.timeout });
    } else {
      return json({ error: 'Zigbee coordinator pairing failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Zigbee pairing control error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
