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

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

const mapDevices = async (): Promise<ZigbeeState> => {
  const { items } = await ZigbeeApi.listDevices();
  return {
    devices: items.map((item) => ({
      id: item.id,
      name: item.displayName ?? item.id,
      type: item.type ?? 'Device',
      state: (item.state as ZigbeeState['devices'][number]['state']) ?? 'inactive',
      lastSeen: item.lastSeen ?? new Date().toISOString(),
      battery: item.batteryPercent ?? 100
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
  };
};

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
    return mapDevices();
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
    await rawRequest(`/zigbee/devices/${deviceId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId }),
      fetch: fetchImpl as RequestOptions['fetch']
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

  const fetchImpl = ensureFetch(options.fetch);
  try {
    return await rawRequest<PairingState>('/zigbee/pairing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds }),
      fetch: fetchImpl as RequestOptions['fetch']
    });
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
    return await rawRequest<PairingState>('/zigbee/pairing', {
      method: 'DELETE',
      fetch: fetchImpl as RequestOptions['fetch']
    });
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
    return await rawRequest<PairingState>('/zigbee/pairing/discovered', {
      method: 'GET',
      fetch: fetchImpl as RequestOptions['fetch']
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

  const fetchImpl = ensureFetch(options.fetch);
  try {
    await rawRequest(`/zigbee/pairing/${deviceId}`, {
      method: 'POST',
      fetch: fetchImpl as RequestOptions['fetch']
    });
  } catch (error) {
    console.warn('TODO(backlog): implement pairing confirm endpoint', error);
  }

  return getZigbeeOverview(options);
};
