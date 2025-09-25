/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CameraClipRequest } from '../models/CameraClipRequest';
import type { CameraClipResponse } from '../models/CameraClipResponse';
import type { CameraSelectionRequest } from '../models/CameraSelectionRequest';
import type { CameraState } from '../models/CameraState';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class CameraService {

  /**
   * Retrieve consolidated camera state for the operator dashboard.
   * Retrieve consolidated camera state for the operator dashboard.
   * @returns CameraState Camera overview payload.
   * @throws ApiError
   */
  public static getCameraOverview(): CancelablePromise<CameraState> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/camera/overview',
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
   * Select the active camera for preview and clip operations.
   * Select the active camera for preview and clip operations.
   * @param requestBody
   * @returns any Camera selection accepted.
   * @throws ApiError
   */
  public static selectCamera(
    requestBody: CameraSelectionRequest,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'PUT',
      url: '/camera/active',
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
   * Mark a camera event as acknowledged.
   * Mark a camera event as acknowledged.
   * @param eventId
   * @returns any Event acknowledgement accepted.
   * @throws ApiError
   */
  public static acknowledgeCameraEvent(
    eventId: string,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/camera/events/{eventId}/ack',
      path: {
        'eventId': eventId,
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

  /**
   * Generate or retrieve a clip for a camera event.
   * Generate or retrieve a clip for a camera event.
   * @param eventId
   * @param requestBody
   * @returns CameraClipResponse Clip URL response.
   * @throws ApiError
   */
  public static requestCameraClip(
    eventId: string,
    requestBody: CameraClipRequest,
  ): CancelablePromise<CameraClipResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/camera/events/{eventId}/clip',
      path: {
        'eventId': eventId,
      },
      body: requestBody,
      mediaType: 'application/json',
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

  /**
   * Refresh the preview for a camera or the active camera when cameraId is 'active'.
   * Refresh the preview for a camera or the active camera when cameraId is 'active'.
   * @param cameraId
   * @returns any Refresh request accepted.
   * @throws ApiError
   */
  public static refreshCamera(
    cameraId: string,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/camera/{cameraId}/refresh',
      path: {
        'cameraId': cameraId,
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
