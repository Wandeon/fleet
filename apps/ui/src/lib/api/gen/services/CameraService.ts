/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CameraClipRequest } from '../models/CameraClipRequest';
import type { CameraClipResponse } from '../models/CameraClipResponse';
import type { CameraEventDetailResponse } from '../models/CameraEventDetailResponse';
import type { CameraEventListResponse } from '../models/CameraEventListResponse';
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
  public static selectCamera(requestBody: CameraSelectionRequest): CancelablePromise<any> {
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
    cursor?: string
  ): CancelablePromise<CameraEventListResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/camera/events',
      query: {
        start: start,
        end: end,
        cameraId: cameraId,
        tags: tags,
        minConfidence: minConfidence,
        maxConfidence: maxConfidence,
        limit: limit,
        cursor: cursor,
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
   * Retrieve a single camera event with metadata and clip reference.
   * Retrieve a single camera event with metadata and clip reference.
   * @param eventId
   * @returns CameraEventDetailResponse Camera event detail response.
   * @throws ApiError
   */
  public static getCameraEvent(eventId: string): CancelablePromise<CameraEventDetailResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/camera/events/{eventId}',
      path: {
        eventId: eventId,
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
   * Mark a camera event as acknowledged.
   * Mark a camera event as acknowledged.
   * @param eventId
   * @returns any Event acknowledgement accepted.
   * @throws ApiError
   */
  public static acknowledgeCameraEvent(eventId: string): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/camera/events/{eventId}/ack',
      path: {
        eventId: eventId,
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
    requestBody: CameraClipRequest
  ): CancelablePromise<CameraClipResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/camera/events/{eventId}/clip',
      path: {
        eventId: eventId,
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
  public static refreshCamera(cameraId: string): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/camera/{cameraId}/refresh',
      path: {
        cameraId: cameraId,
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
