import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params, parent }) => {
  const { layout } = await parent();
  const deviceId = params.id;

  // Mock device data based on ID - in real implementation, this would fetch from API
  const mockDevice = {
    id: deviceId,
    name: deviceId === 'pi-audio-01' ? 'Audio Pi 01' : `Device ${deviceId}`,
    role: deviceId === 'pi-audio-01' ? 'audio' : 'unknown',
    module: deviceId === 'pi-audio-01' ? 'audio' : 'unknown',
    status: 'offline' as const,
    lastSeen: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
    ipAddress: deviceId === 'pi-audio-01' ? '100.127.65.25' : '192.168.1.100',
    capabilities: deviceId === 'pi-audio-01' ? ['playbook', 'volume', 'routing'] : [],
    uptime: '2d 14h 32m',
    version: '1.2.3',
    logs: [
      {
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
        level: 'error' as const,
        message: 'Connection timeout to upstream service'
      },
      {
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 mins ago
        level: 'warn' as const,
        message: 'High memory usage detected: 85%'
      },
      {
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
        level: 'info' as const,
        message: 'Device agent started successfully'
      }
    ]
  };

  // Validate the device exists - for demo, only allow pi-audio-01 or numeric IDs
  if (deviceId !== 'pi-audio-01' && !/^\d+$/.test(deviceId)) {
    throw error(404, 'Device not found');
  }

  return {
    layout,
    device: mockDevice
  };
};