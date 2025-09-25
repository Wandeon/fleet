/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FleetDeviceDetail } from '../models/FleetDeviceDetail';
import type { FleetOverview } from '../models/FleetOverview';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class FleetService {

  /**
   * Retrieve aggregate fleet status for operator dashboards.
   * Retrieve aggregate fleet status for operator dashboards.
   * @returns FleetOverview Fleet-wide module and device summary.
   * @throws ApiError
   */
  public static getFleetOverview(): CancelablePromise<FleetOverview> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/fleet/overview',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

  /**
   * Retrieve detailed status, metrics, and actions for a fleet device.
   * Retrieve detailed status, metrics, and actions for a fleet device.
   * @param deviceId
   * @returns FleetDeviceDetail Detailed device view for operator troubleshooting.
   * @throws ApiError
   */
  public static getFleetDeviceDetail(
    deviceId: string,
  ): CancelablePromise<FleetDeviceDetail> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/fleet/devices/{deviceId}',
      path: {
        'deviceId': deviceId,
      },
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        404: `Requested resource does not exist.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

  /**
   * Trigger a quick action on a fleet device.
   * Trigger a quick action on a fleet device.
   * @param deviceId
   * @param actionId
   * @returns string Action accepted for asynchronous execution.
   * @throws ApiError
   */
  public static triggerFleetDeviceAction(
    deviceId: string,
    actionId: string,
  ): CancelablePromise<string> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/fleet/devices/{deviceId}/actions/{actionId}',
      path: {
        'deviceId': deviceId,
        'actionId': actionId,
      },
      responseHeader: 'x-correlation-id',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        404: `Requested resource does not exist.`,
        409: `Device is busy and cannot accept the requested action.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

}
