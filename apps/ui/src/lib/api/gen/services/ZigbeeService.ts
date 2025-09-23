/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ZigbeeActionRequest } from '../models/ZigbeeActionRequest';
import type { ZigbeeDeviceList } from '../models/ZigbeeDeviceList';
import type { ZigbeeDeviceSummary } from '../models/ZigbeeDeviceSummary';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class ZigbeeService {

  /**
   * List Zigbee devices with their latest state.
   * Provides a paginated list of Zigbee switches, sensors, and lights with recent telemetry.
   * @param limit Maximum number of results to return.
   * @param cursor Opaque pagination cursor returned by previous responses.
   * @returns ZigbeeDeviceList Zigbee device collection.
   * @throws ApiError
   */
  public static listZigbeeDevices(
    limit: number = 50,
    cursor?: string,
  ): CancelablePromise<ZigbeeDeviceList> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/zigbee/devices',
      query: {
        'limit': limit,
        'cursor': cursor,
      },
      errors: {
        401: `Authentication credentials missing or invalid.`,
        403: `Authenticated user lacks required scope.`,
        429: `Request rate limit exceeded.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

  /**
   * Execute a control action on a Zigbee device.
   * Sends toggle, on/off, or scene commands to a Zigbee endpoint and reports the updated device state.
   * @param id
   * @param requestBody
   * @returns ZigbeeDeviceSummary Action accepted.
   * @throws ApiError
   */
  public static runZigbeeDeviceAction(
    id: string,
    requestBody: ZigbeeActionRequest,
  ): CancelablePromise<ZigbeeDeviceSummary> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/zigbee/devices/{id}/action',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        401: `Authentication credentials missing or invalid.`,
        403: `Authenticated user lacks required scope.`,
        404: `Requested resource could not be found.`,
        409: `Resource is in a conflicting state.`,
        422: `Request payload failed validation.`,
        429: `Request rate limit exceeded.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

}
