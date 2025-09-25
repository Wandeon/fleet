/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ZigbeeActionRequest } from '../models/ZigbeeActionRequest';
import type { ZigbeePairingStartRequest } from '../models/ZigbeePairingStartRequest';
import type { ZigbeePairingState } from '../models/ZigbeePairingState';
import type { ZigbeeState } from '../models/ZigbeeState';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class ZigbeeService {

  /**
   * Retrieve Zigbee hub state, devices, and quick actions.
   * Retrieve Zigbee hub state, devices, and quick actions.
   * @returns ZigbeeState Zigbee overview payload.
   * @throws ApiError
   */
  public static getZigbeeOverview(): CancelablePromise<ZigbeeState> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/zigbee/overview',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

  /**
   * Execute a quick action on a Zigbee device.
   * Execute a quick action on a Zigbee device.
   * @param deviceId
   * @param requestBody
   * @returns any Action accepted.
   * @throws ApiError
   */
  public static runZigbeeAction(
    deviceId: string,
    requestBody: ZigbeeActionRequest,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/zigbee/devices/{deviceId}/action',
      path: {
        'deviceId': deviceId,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `One or more request parameters failed validation.`,
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        404: `Requested resource does not exist.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
      },
    });
  }

  /**
   * Start Zigbee pairing mode for discovering new devices.
   * Start Zigbee pairing mode for discovering new devices.
   * @param requestBody
   * @returns ZigbeePairingState Pairing window started.
   * @throws ApiError
   */
  public static startZigbeePairing(
    requestBody?: ZigbeePairingStartRequest,
  ): CancelablePromise<ZigbeePairingState> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/zigbee/pairing',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `One or more request parameters failed validation.`,
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
      },
    });
  }

  /**
   * Stop Zigbee pairing mode.
   * Stop Zigbee pairing mode.
   * @returns ZigbeePairingState Pairing mode stopped.
   * @throws ApiError
   */
  public static stopZigbeePairing(): CancelablePromise<ZigbeePairingState> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/zigbee/pairing',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
      },
    });
  }

  /**
   * Poll for newly discovered Zigbee devices during pairing mode.
   * Poll for newly discovered Zigbee devices during pairing mode.
   * @returns ZigbeePairingState Discovered devices snapshot.
   * @throws ApiError
   */
  public static pollZigbeeDiscovered(): CancelablePromise<ZigbeePairingState> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/zigbee/pairing/discovered',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
      },
    });
  }

  /**
   * Confirm pairing of a discovered Zigbee device.
   * Confirm pairing of a discovered Zigbee device.
   * @param deviceId
   * @returns any Pairing confirmation accepted.
   * @throws ApiError
   */
  public static confirmZigbeePairing(
    deviceId: string,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/zigbee/pairing/{deviceId}',
      path: {
        'deviceId': deviceId,
      },
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        404: `Requested resource does not exist.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
      },
    });
  }

}
