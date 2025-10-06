import { USE_MOCKS, UiApiError, type RequestOptions, rawRequest } from '$lib/api/client';
import { mockApi } from '$lib/api/mock';
import type { ZigbeeState } from '$lib/types';

export interface ZigbeeQueryOptions {
  fetch?: typeof fetch;
}

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

export const getZigbeeOverview = async (options: ZigbeeQueryOptions = {}): Promise<ZigbeeState> => {
  if (USE_MOCKS) {
    return mockApi.zigbee();
  }

  const fetchImpl = ensureFetch(options.fetch);
  try {
    return await rawRequest<ZigbeeState>('/zigbee/summary', {
      method: 'GET',
      fetch: fetchImpl as RequestOptions['fetch'],
    });
  } catch (error) {
    // Zigbee may not be implemented yet, return empty state
    return {
      devices: [],
      quickActions: [],
      hubStatus: 'offline',
      pairing: undefined,
    };
  }
};
