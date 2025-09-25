/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { VideoPreviewRequest } from '../models/VideoPreviewRequest';
import type { VideoRecordingSegment } from '../models/VideoRecordingSegment';
import type { VideoState } from '../models/VideoState';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class VideoService {

  /**
   * Retrieve consolidated video device status.
   * Retrieve consolidated video device status.
   * @returns VideoState Video overview for the primary display node.
   * @throws ApiError
   */
  public static getVideoOverview(): CancelablePromise<VideoState> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/video/overview',
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
   * Retrieve recording segments for the active video source.
   * Retrieve recording segments for the active video source.
   * @returns VideoRecordingSegment Recording segments available for playback.
   * @throws ApiError
   */
  public static getVideoRecordings(): CancelablePromise<Array<VideoRecordingSegment>> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/video/recordings',
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
   * Generate a signed URL for a live video preview stream.
   * Generate a signed URL for a live video preview stream.
   * @param requestBody
   * @returns any Signed preview stream URL.
   * @throws ApiError
   */
  public static generateVideoPreview(
    requestBody?: VideoPreviewRequest,
  ): CancelablePromise<{
    streamUrl: string;
  }> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/video/preview',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        404: `Requested resource does not exist.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

}
