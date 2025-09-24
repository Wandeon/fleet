import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    // Mock API call to Zigbee coordinator - replace with actual device communication
    const response = await fetch('http://pi-zigbee-01:8084/discover', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-zigbee-01-token' // Replace with actual token from env
      }
    });

    if (response.ok) {
      const result = await response.json();
      return json({
        devices: result.devices || [],
        scanning: result.scanning || false
      });
    } else {
      return json({ error: 'Zigbee device discovery failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Zigbee discovery error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};