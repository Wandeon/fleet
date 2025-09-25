import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { apiClient } from '$lib/api/client';
import { fetchLogsSnapshot } from '$lib/api/logs-operations';
import type { LogEntry } from '$lib/types';

export const load: PageLoad = async ({ params, fetch, depends, parent }) => {
  depends('app:fleet-device');

  const deviceId = params.id;
  if (!deviceId) {
    throw error(400, 'Device id is required');
  }

  const parentData = await parent();

  const [state, audioState] = await Promise.all([
    apiClient.fetchState({ fetch }),
    apiClient.fetchAudio({ fetch })
  ]);

  const audioDevices = state.audio?.devices ?? [];
  const summary = audioDevices.find((device) => String(device.id) === deviceId);
  if (!summary) {
    throw error(404, 'Device not found');
  }

  const audioDetails = audioState.devices.find((device) => device.id === deviceId);

  const status: 'online' | 'offline' | 'error' = summary.online
    ? 'online'
    : summary.reason
      ? 'error'
      : 'offline';

  const device = {
    id: deviceId,
    name: audioDetails?.name ?? summary.name ?? deviceId,
    module: summary.module ?? 'audio',
    role: summary.role ?? 'audio',
    status,
    reason: summary.reason ?? null,
    lastSeen: audioDetails?.lastUpdated ?? null,
    capabilities: audioDetails?.capabilities ?? [],
    playback: audioDetails?.playback,
  };

  const snapshot = await fetchLogsSnapshot({ fetch, level: 'debug', limit: 200 });
  const deviceKey = deviceId.toLowerCase();
  const logs: LogEntry[] = snapshot.entries
    .filter((entry) => {
      const hostMatch = entry.host.toLowerCase().includes(deviceKey);
      const contextDevice = (entry.context as { deviceId?: unknown } | undefined)?.deviceId;
      const contextDeviceId = typeof contextDevice === 'string' ? contextDevice.toLowerCase() : null;
      const contextMatch = contextDeviceId === deviceKey;
      const messageMatch = entry.msg.toLowerCase().includes(deviceKey);
      return hostMatch || contextMatch || messageMatch;
    })
    .slice(0, 10);

  return {
    layout: parentData.layout ?? null,
    device,
    logs,
  };
};
