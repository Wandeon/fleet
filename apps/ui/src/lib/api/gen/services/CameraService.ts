/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CameraEvents } from '../models/CameraEvents';
import type { CameraPreview } from '../models/CameraPreview';
import type { CameraSummary } from '../models/CameraSummary';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class CameraService {

  /**
   * Retrieve aggregated camera health and storage information.
   * Summarises camera online/offline status and recording storage utilisation.
   * @returns CameraSummary Camera summary data.
   * @throws ApiError
   */
  public static getCameraSummary(): CancelablePromise<CameraSummary> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/camera/summary',
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
   * List recent camera events.
   * Provides paginated camera motion/offline events with optional time filtering.
   * @param limit Maximum number of events to return.
   * @param cursor Opaque pagination cursor returned by previous responses.
   * @param since Filter events to those occurring at or after the ISO-8601 timestamp.
   * @returns CameraEvents Recent camera events.
   * @throws ApiError
   */
  public static listCameraEvents(
    limit: number = 50,
    cursor?: string,
    since?: string,
  ): CancelablePromise<CameraEvents> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/camera/events',
      query: {
        'limit': limit,
        'cursor': cursor,
        'since': since,
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
   * Generate a temporary preview URL for a camera feed.
   * Issues a signed URL for live preview playback when available for the requested camera.
   * @param id
   * @returns CameraPreview Preview URL for the requested camera.
   * @throws ApiError
   */
  public static getCameraPreview(
    id: string,
  ): CancelablePromise<CameraPreview> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/camera/preview/{id}',
      path: {
        'id': id,
      },
      errors: {
        401: `Authentication credentials missing or invalid.`,
        403: `Authenticated user lacks required scope.`,
        404: `Requested resource could not be found.`,
        429: `Request rate limit exceeded.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

}
