import { rawRequest, USE_MOCKS } from '$lib/api/client';
import type { RequestOptions } from '$lib/api/client';
import { mockApi } from '$lib/api/mock';
import type { FleetDeviceDetail, FleetOverview } from '$lib/types';

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

export interface FleetFetchOptions {
  fetch?: typeof fetch;
}

export const getFleetOverview = async (options: FleetFetchOptions = {}): Promise<FleetOverview> => {
  if (USE_MOCKS) {
    return mockApi.fleetOverview();
  }

  const fetchImpl = ensureFetch(options.fetch);
  return rawRequest<FleetOverview>('/fleet/overview', {
    method: 'GET',
    fetch: fetchImpl as RequestOptions['fetch']
  });
};

export const getFleetDeviceDetail = async (
  deviceId: string,
  options: FleetFetchOptions = {}
): Promise<FleetDeviceDetail> => {
  if (USE_MOCKS) {
    return mockApi.fleetDevice(deviceId);
  }

  const fetchImpl = ensureFetch(options.fetch);
  return rawRequest<FleetDeviceDetail>(`/fleet/devices/${encodeURIComponent(deviceId)}`, {
    method: 'GET',
    fetch: fetchImpl as RequestOptions['fetch']
  });
};

export const triggerDeviceAction = async (
  deviceId: string,
  actionId: string,
  options: FleetFetchOptions = {}
): Promise<FleetDeviceDetail> => {
  if (USE_MOCKS) {
    return mockApi.fleetExecuteAction(deviceId, actionId);
  }

  const fetchImpl = ensureFetch(options.fetch);
  await rawRequest(`/fleet/devices/${encodeURIComponent(deviceId)}/actions/${encodeURIComponent(actionId)}`, {
    method: 'POST',
    fetch: fetchImpl as RequestOptions['fetch']
  });
  return getFleetDeviceDetail(deviceId, options);
};
