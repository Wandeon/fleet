/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TvInputRequest } from '../models/TvInputRequest';
import type { TvMuteRequest } from '../models/TvMuteRequest';
import type { TvPowerRequest } from '../models/TvPowerRequest';
import type { TvStatus } from '../models/TvStatus';
import type { TvVolumeRequest } from '../models/TvVolumeRequest';
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

  /**
   * Retrieve the current TV state.
   * Reports the TV's power, input, volume, and mute status via the backend CEC adapter.
   * @returns TvStatus TV status details.
   * @throws ApiError
   */
  public static getTvStatus(): CancelablePromise<TvStatus> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/video/tv',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

  /**
   * Toggle TV power state.
   * Sends a CEC command to turn the TV on or off and returns the updated status snapshot.
   * @param requestBody
   * @returns TvStatus Updated TV status.
   * @throws ApiError
   */
  public static setTvPower(
    requestBody: TvPowerRequest,
  ): CancelablePromise<TvStatus> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/video/tv/power',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        409: `TV is already processing another command.`,
        422: `One or more request parameters failed validation.`,
        429: `Request rate limit exceeded.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

  /**
   * Change the active TV input.
   * Switches the HDMI input using CEC and yields the refreshed device status.
   * @param requestBody
   * @returns TvStatus Updated TV status.
   * @throws ApiError
   */
  public static setTvInput(
    requestBody: TvInputRequest,
  ): CancelablePromise<TvStatus> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/video/tv/input',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        409: `Requested operation conflicts with the current resource state.`,
        422: `One or more request parameters failed validation.`,
        429: `Request rate limit exceeded.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

  /**
   * Set the absolute TV volume level.
   * Issues an absolute volume command and returns the post-change TV status payload.
   * @param requestBody
   * @returns TvStatus Updated TV status including volume details.
   * @throws ApiError
   */
  public static setTvVolume(
    requestBody: TvVolumeRequest,
  ): CancelablePromise<TvStatus> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/video/tv/volume',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        422: `One or more request parameters failed validation.`,
        429: `Request rate limit exceeded.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

  /**
   * Toggle TV mute state.
   * Updates the mute flag through CEC commands and returns the latest status snapshot.
   * @param requestBody
   * @returns TvStatus Updated TV status.
   * @throws ApiError
   */
  public static setTvMute(
    requestBody: TvMuteRequest,
  ): CancelablePromise<TvStatus> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/video/tv/mute',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        422: `One or more request parameters failed validation.`,
        429: `Request rate limit exceeded.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

}
