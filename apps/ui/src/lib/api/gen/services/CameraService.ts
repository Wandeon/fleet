/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CameraEventListResponse } from '../models/CameraEventListResponse';
import type { CameraPreviewState } from '../models/CameraPreviewState';
import type { CameraState } from '../models/CameraState';
import type { CameraStreamListResponse } from '../models/CameraStreamListResponse';

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
  public static getCameraSummary(): CancelablePromise<CameraState> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/camera/summary',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * List camera AI events with optional filters.
   * Retrieve camera detections with support for time range, confidence, and tag filtering.
   * @param start Return events that occurred at or after this timestamp.
   * @param end Return events that occurred at or before this timestamp.
   * @param cameraId Restrict results to a single camera identifier.
   * @param tags Comma separated list of tags that must be present on the event.
   * @param minConfidence Minimum detection confidence (0.0-1.0 or percentage).
   * @param maxConfidence Maximum detection confidence (0.0-1.0 or percentage).
   * @param limit Maximum number of events to return in a single response.
   * @param cursor Cursor returned by a previous request for pagination.
   * @returns CameraEventListResponse Camera event collection.
   * @throws ApiError
   */
  public static listCameraEvents(
    start?: string,
    end?: string,
    cameraId?: string,
    tags?: Array<string>,
    minConfidence?: number,
    maxConfidence?: number,
    limit: number = 50,
    cursor?: string,
  ): CancelablePromise<CameraEventListResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/camera/events',
      query: {
        'start': start,
        'end': end,
        'cameraId': cameraId,
        'tags': tags,
        'minConfidence': minConfidence,
        'maxConfidence': maxConfidence,
        'limit': limit,
        'cursor': cursor,
      },
      errors: {
        400: `One or more request parameters failed validation.`,
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
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
      url: '/api/camera/events/{eventId}/ack',
      path: {
        'eventId': eventId,
      },
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        422: `One or more request parameters failed validation.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Retrieve preview status for a camera.
   * Retrieve preview readiness for a specific camera including offline reasons.
   * @param cameraId
   * @returns CameraPreviewState Preview status response.
   * @throws ApiError
   */
  public static getCameraPreview(
    cameraId: string,
  ): CancelablePromise<CameraPreviewState> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/camera/preview/{cameraId}',
      path: {
        'cameraId': cameraId,
      },
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        404: `Requested resource does not exist.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * List camera stream metadata and availability.
   * Enumerate camera streams, providing status and offline reasons for monitoring.
   * @returns CameraStreamListResponse Camera stream collection.
   * @throws ApiError
   */
  public static listCameraStreams(): CancelablePromise<CameraStreamListResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/camera/streams',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

}
