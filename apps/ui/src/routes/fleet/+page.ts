import type { PageLoad } from './$types';
import { apiClient } from '$lib/api/client';

interface FleetDeviceSummary {
  id: string;
  name: string;
  module: string;
  role: string;
  status: 'online' | 'offline' | 'error';
  detail?: string | null;
}

export const load: PageLoad = async ({ fetch, depends, parent }) => {
  depends('app:fleet');

  const parentData = await parent();

  const toResult = async <T>(promise: Promise<T>) => {
    try {
      const value = await promise;
      return { value, error: null as string | null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      return { value: null as T | null, error: message };
    }
  };

  const [layoutResult, stateResult] = await Promise.all([
    toResult(apiClient.fetchLayout({ fetch })),
    toResult(apiClient.fetchState({ fetch })),
  ]);

  const layout = layoutResult.value ?? parentData.layout ?? null;
  const layoutError = layoutResult.error ?? parentData.layoutError ?? null;

  const audioDevices = stateResult.value?.audio?.devices ?? [];
  const devices: FleetDeviceSummary[] = audioDevices.map((device) => ({
    id: String(device.id ?? 'unknown-device'),
    name: typeof device.name === 'string' ? device.name : `Device ${device.id}`,
    module: typeof device.module === 'string' ? device.module : 'audio',
    role: typeof device.role === 'string' ? device.role : 'audio',
    status: device.online ? 'online' : 'offline',
    detail: device.reason ?? null,
  }));

  const fleet = {
    updatedAt: stateResult.value?.updatedAt ?? new Date().toISOString(),
    total: audioDevices.length,
    online: audioDevices.filter((device) => device.online).length,
    devices,
  };

  return {
    layout,
    layoutError,
    fleet,
    error: stateResult.error,
  };
};
