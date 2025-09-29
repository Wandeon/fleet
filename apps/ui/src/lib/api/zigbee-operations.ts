import { rawRequest, USE_MOCKS } from '$lib/api/client';
import type { RequestOptions } from '$lib/api/client';
import { mockApi } from '$lib/api/mock';
import type { ZigbeeState } from '$lib/types';
import { guardPlaceholder } from '$lib/feature-flags';

interface PairingState {
  active: boolean;
  expiresAt?: string;
  discovered: { id: string; name: string; type: string; signal: number }[];
}

interface LegacyZigbeeDevice {
  id: string;
  displayName?: string;
  type?: string;
  state?: string;
  batteryPercent?: number | null;
  lastSeen?: string;
}

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

const legacyZigbeeOverview = async (fetchImpl: typeof fetch): Promise<ZigbeeState> => {
  const response = await rawRequest<{ items?: LegacyZigbeeDevice[] }>('/zigbee/devices', {
    fetch: fetchImpl as RequestOptions['fetch'],
  });
  const items = response?.items ?? [];
  return {
    devices: items.map((item) => ({
      id: item.id,
      name: item.displayName ?? item.id,
      type: item.type ?? 'Device',
      state: (item.state as ZigbeeState['devices'][number]['state']) ?? 'inactive',
      lastSeen: item.lastSeen ?? new Date().toISOString(),
      battery: item.batteryPercent ?? undefined,
    })),
    quickActions: [
      { id: 'open', label: 'Open', description: 'Trigger open action' },
      { id: 'close', label: 'Close', description: 'Trigger close action' },
    ],
    hubStatus: 'online',
    pairing: {
      active: false,
      discovered: [],
    },
  } satisfies ZigbeeState;
};

export const getZigbeeOverview = async (
  options: { fetch?: typeof fetch } = {}
): Promise<ZigbeeState> => {
  if (USE_MOCKS) {
    return mockApi.zigbee();
  }

  const fetchImpl = ensureFetch(options.fetch);

  try {
    return await rawRequest<ZigbeeState>('/zigbee/overview', {
      method: 'GET',
      fetch: fetchImpl as RequestOptions['fetch'],
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /zigbee/overview endpoint', error);
    return legacyZigbeeOverview(fetchImpl);
  }
};

export const runZigbeeAction = async (
  deviceId: string,
  actionId: string,
  options: { fetch?: typeof fetch } = {}
): Promise<ZigbeeState> => {
  if (USE_MOCKS) {
    return mockApi.zigbeeRunAction(deviceId, actionId);
  }

  // Guard placeholder implementation with feature flag
  guardPlaceholder('ZIGBEE_QUICK_ACTIONS_ENABLED', 'Zigbee quick actions are not yet implemented', 'Planned for v2.1 - requires zigbee action endpoint');

  const fetchImpl = ensureFetch(options.fetch);
  try {
    await rawRequest(`/zigbee/devices/${deviceId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId }),
      fetch: fetchImpl as RequestOptions['fetch'],
    });
  } catch (error) {
    console.warn('TODO(backlog): implement zigbee action endpoint', error);
  }
  return getZigbeeOverview(options);
};

export const startPairing = async (
  durationSeconds = 60,
  options: { fetch?: typeof fetch } = {}
): Promise<PairingState> => {
  if (USE_MOCKS) {
    return mockApi.zigbeeStartPairing(durationSeconds) ?? { active: true, discovered: [] };
  }

  // Guard placeholder implementation with feature flag
  guardPlaceholder('ZIGBEE_PAIRING_ENABLED', 'Zigbee device pairing is not yet implemented', 'Planned for v2.1 - requires zigbee pairing endpoint');

  const fetchImpl = ensureFetch(options.fetch);
  try {
    return await rawRequest<PairingState>('/zigbee/pairing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds }),
      fetch: fetchImpl as RequestOptions['fetch'],
    });
  } catch (error) {
    console.warn('TODO(backlog): implement zigbee pairing endpoint', error);
    return {
      active: true,
      discovered: [],
      expiresAt: new Date(Date.now() + durationSeconds * 1000).toISOString(),
    };
  }
};

export const stopPairing = async (
  options: { fetch?: typeof fetch } = {}
): Promise<PairingState> => {
  if (USE_MOCKS) {
    return mockApi.zigbeeStopPairing() ?? { active: false, discovered: [] };
  }

  // Guard placeholder implementation with feature flag
  guardPlaceholder('ZIGBEE_PAIRING_ENABLED', 'Zigbee device pairing is not yet implemented', 'Planned for v2.1 - requires pairing stop endpoint');

  const fetchImpl = ensureFetch(options.fetch);
  try {
    return await rawRequest<PairingState>('/zigbee/pairing', {
      method: 'DELETE',
      fetch: fetchImpl as RequestOptions['fetch'],
    });
  } catch (error) {
    console.warn('TODO(backlog): implement pairing stop endpoint', error);
    return { active: false, discovered: [] };
  }
};

export const pollDiscoveredDevices = async (
  options: { fetch?: typeof fetch } = {}
): Promise<PairingState> => {
  if (USE_MOCKS) {
    return mockApi.zigbeeDiscoverCandidate() ?? { active: true, discovered: [] };
  }

  // Guard placeholder implementation with feature flag
  guardPlaceholder('ZIGBEE_PAIRING_ENABLED', 'Zigbee device pairing is not yet implemented', 'Planned for v2.1 - requires pairing discovery endpoint');

  const fetchImpl = ensureFetch(options.fetch);
  try {
    return await rawRequest<PairingState>('/zigbee/pairing/discovered', {
      method: 'GET',
      fetch: fetchImpl as RequestOptions['fetch'],
    });
  } catch (error) {
    console.warn('TODO(backlog): implement pairing discovery endpoint', error);
    return { active: false, discovered: [] };
  }
};

export const confirmPairing = async (
  deviceId: string,
  options: { fetch?: typeof fetch } = {}
): Promise<ZigbeeState> => {
  if (USE_MOCKS) {
    return mockApi.zigbeeConfirmPairing(deviceId);
  }

  // Guard placeholder implementation with feature flag
  guardPlaceholder('ZIGBEE_PAIRING_ENABLED', 'Zigbee device pairing is not yet implemented', 'Planned for v2.1 - requires pairing confirm endpoint');

  const fetchImpl = ensureFetch(options.fetch);
  try {
    await rawRequest(`/zigbee/pairing/${deviceId}`, {
      method: 'POST',
      fetch: fetchImpl as RequestOptions['fetch'],
    });
  } catch (error) {
    console.warn('TODO(backlog): implement pairing confirm endpoint', error);
  }

  return getZigbeeOverview(options);
};
