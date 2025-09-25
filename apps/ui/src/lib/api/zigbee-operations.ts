import {
  rawRequest,
  USE_MOCKS,
  ZigbeeApi
} from '$lib/api/client';
import type { RequestOptions } from '$lib/api/client';
import { mockApi } from '$lib/api/mock';
import type { ZigbeeState } from '$lib/types';

interface PairingState {
  active: boolean;
  expiresAt?: string;
  discovered: { id: string; name: string; type: string; signal: number }[];
}

interface LegacyZigbeeDeviceSummary {
  id: string;
  displayName?: string;
  type?: string;
  state?: string;
  batteryPercent?: number | null;
  lastSeen?: string;
}

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

const mapLegacyDevices = (items: LegacyZigbeeDeviceSummary[]): ZigbeeState => ({
  devices: items.map((item) => ({
    id: item.id,
    name: item.displayName ?? item.id,
    type: item.type ?? 'Device',
    state: (item.state as ZigbeeState['devices'][number]['state']) ?? 'inactive',
    lastSeen: item.lastSeen ?? new Date().toISOString(),
    battery: item.batteryPercent ?? undefined
  })),
  quickActions: [
    { id: 'open', label: 'Open', description: 'Trigger open action' },
    { id: 'close', label: 'Close', description: 'Trigger close action' }
  ],
  hubStatus: 'online',
  pairing: {
    active: false,
    discovered: []
  }
});

const mapPairingState = (state: {
  active: boolean;
  expiresAt?: string | null;
  discovered: Array<{ id: string; name: string; type: string; signal: number }>;
}): PairingState => ({
  active: state.active,
  expiresAt: state.expiresAt ?? undefined,
  discovered: state.discovered ?? []
});

export const getZigbeeOverview = async (options: { fetch?: typeof fetch } = {}): Promise<ZigbeeState> => {
  if (USE_MOCKS) {
    return mockApi.zigbee();
  }

  const fetchImpl = ensureFetch(options.fetch);

  try {
    return await rawRequest<ZigbeeState>('/zigbee/overview', {
      method: 'GET',
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement /zigbee/overview endpoint', error);
    try {
      const legacy = await rawRequest<{ items?: LegacyZigbeeDeviceSummary[] }>('/zigbee/devices', {
        method: 'GET',
        fetch: fetchImpl as RequestOptions['fetch']
      });
      return mapLegacyDevices(legacy?.items ?? []);
    } catch (fallbackError) {
      console.warn('Legacy zigbee device list unavailable', fallbackError);
      return mapLegacyDevices([]);
    }
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

  const fetchImpl = ensureFetch(options.fetch);
  try {
    await ZigbeeApi.runAction(deviceId, { actionId });
  } catch (error) {
    console.warn('TODO(backlog): implement zigbee action endpoint', error);
    await rawRequest(`/zigbee/devices/${deviceId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId }),
      fetch: fetchImpl as RequestOptions['fetch']
    });
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

  const fetchImpl = ensureFetch(options.fetch);
  try {
    const result = await ZigbeeApi.startPairing({ durationSeconds });
    return mapPairingState(result);
  } catch (error) {
    console.warn('TODO(backlog): implement zigbee pairing endpoint', error);
    return {
      active: true,
      discovered: [],
      expiresAt: new Date(Date.now() + durationSeconds * 1000).toISOString()
    };
  }
};

export const stopPairing = async (options: { fetch?: typeof fetch } = {}): Promise<PairingState> => {
  if (USE_MOCKS) {
    return mockApi.zigbeeStopPairing() ?? { active: false, discovered: [] };
  }
  const fetchImpl = ensureFetch(options.fetch);
  try {
    const state = await ZigbeeApi.stopPairing();
    return mapPairingState(state);
  } catch (error) {
    console.warn('TODO(backlog): implement pairing stop endpoint', error);
    return { active: false, discovered: [] };
  }
};

export const pollDiscoveredDevices = async (options: { fetch?: typeof fetch } = {}): Promise<PairingState> => {
  if (USE_MOCKS) {
    return mockApi.zigbeeDiscoverCandidate() ?? { active: true, discovered: [] };
  }
  const fetchImpl = ensureFetch(options.fetch);
  try {
    const state = await ZigbeeApi.pollDiscovered();
    return mapPairingState(state);
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

  const fetchImpl = ensureFetch(options.fetch);
  try {
    await ZigbeeApi.confirmPairing(deviceId);
  } catch (error) {
    console.warn('TODO(backlog): implement pairing confirm endpoint', error);
    await rawRequest(`/zigbee/pairing/${deviceId}`, {
      method: 'POST',
      fetch: fetchImpl as RequestOptions['fetch']
    });
  }

  return getZigbeeOverview(options);
};
