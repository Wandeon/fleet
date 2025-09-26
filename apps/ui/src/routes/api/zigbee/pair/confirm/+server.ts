import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { deviceId } = await request.json();

    if (!deviceId || typeof deviceId !== 'string') {
      return json({ error: 'Invalid device ID' }, { status: 400 });
    }

    // Mock API call to Zigbee coordinator - replace with actual device communication
    const response = await fetch('http://pi-zigbee-01:8084/pair/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-zigbee-01-token', // Replace with actual token from env
      },
      body: JSON.stringify({ deviceId }),
    });

    if (response.ok) {
      const result = await response.json();
      return json({
        success: true,
        deviceId: result.deviceId,
        name: result.name,
        type: result.type,
      });
    } else {
      const error = await response.json();
      return json(
        { error: error.message || 'Device pairing confirmation failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Zigbee pairing confirmation error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
