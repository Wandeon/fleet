import { rawRequest, USE_MOCKS } from '$lib/api/client';
import type { RequestOptions } from '$lib/api/client';
import { mockApi } from '$lib/api/mock';
import type { ZigbeeState } from '$lib/types';
import { ZigbeeService } from '$lib/api/gen/services/ZigbeeService';
import type { ZigbeePairingState } from '$lib/api/gen/models/ZigbeePairingState';

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
    console.warn('Falling back to legacy Zigbee overview endpoint', error);
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

  const fetchImpl = ensureFetch(options.fetch);

  try {
    await rawRequest(`/zigbee/devices/${deviceId}/command`, {
      method: 'POST',
      body: {
        deviceId,
        command: actionId,
      },
      fetch: fetchImpl as RequestOptions['fetch'],
    });
  } catch (error) {
    console.error('Zigbee action failed:', error);
    throw error;
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

  try {
    const result: ZigbeePairingState = await ZigbeeService.startZigbeePairing({
      durationSeconds,
    });
    return {
      active: result.active,
      expiresAt: result.expiresAt ?? undefined,
      discovered: result.discovered.map(candidate => ({
        id: candidate.id,
        name: candidate.model,
        type: candidate.manufacturer,
        signal: candidate.signal,
      })),
    };
  } catch (error) {
    console.error('Zigbee pairing failed:', error);
    throw error;
  }
};

export const stopPairing = async (
  options: { fetch?: typeof fetch } = {}
): Promise<PairingState> => {
  if (USE_MOCKS) {
    return mockApi.zigbeeStopPairing() ?? { active: false, discovered: [] };
  }

  try {
    const result: ZigbeePairingState = await ZigbeeService.stopZigbeePairing();
    return {
      active: result.active,
      expiresAt: result.expiresAt ?? undefined,
      discovered: result.discovered.map(candidate => ({
        id: candidate.id,
        name: candidate.model,
        type: candidate.manufacturer,
        signal: candidate.signal,
      })),
    };
  } catch (error) {
    console.error('Zigbee stop pairing failed:', error);
    throw error;
  }
};

export const pollDiscoveredDevices = async (
  options: { fetch?: typeof fetch } = {}
): Promise<PairingState> => {
  if (USE_MOCKS) {
    return mockApi.zigbeeDiscoverCandidate() ?? { active: true, discovered: [] };
  }

  try {
    const result: ZigbeePairingState = await ZigbeeService.pollZigbeeDiscovered();
    return {
      active: result.active,
      expiresAt: result.expiresAt ?? undefined,
      discovered: result.discovered.map(candidate => ({
        id: candidate.id,
        name: candidate.model,
        type: candidate.manufacturer,
        signal: candidate.signal,
      })),
    };
  } catch (error) {
    console.error('Zigbee poll discovered failed:', error);
    throw error;
  }
};

export const confirmPairing = async (
  deviceId: string,
  options: { fetch?: typeof fetch } = {}
): Promise<ZigbeeState> => {
  if (USE_MOCKS) {
    return mockApi.zigbeeConfirmPairing(deviceId);
  }

  try {
    await ZigbeeService.confirmZigbeePairing(deviceId);
  } catch (error) {
    console.error('Zigbee confirm pairing failed:', error);
    throw error;
  }

  return getZigbeeOverview(options);
};
