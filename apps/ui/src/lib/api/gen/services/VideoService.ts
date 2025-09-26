/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { VideoClipExport } from '../models/VideoClipExport';
import type { VideoDeviceState } from '../models/VideoDeviceState';
import type { VideoOverview } from '../models/VideoOverview';
import type { VideoPowerState } from '../models/VideoPowerState';
import type { VideoPreviewRequest } from '../models/VideoPreviewRequest';
import type { VideoPreviewSession } from '../models/VideoPreviewSession';
import type { VideoRecordingSegment } from '../models/VideoRecordingSegment';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class VideoService {

  /**
   * Retrieve consolidated video device status.
   * Retrieve consolidated video device status.
   * @returns VideoOverview Video overview for the primary display node.
   * @throws ApiError
   */
  public static getVideoOverview(): CancelablePromise<VideoOverview> {
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
   * List managed video devices and their current state.
   * Enumerate video endpoints, including power, mute, and input state for the operator dashboard.
   * @returns any Video device inventory.
   * @throws ApiError
   */
  public static listVideoDevices(): CancelablePromise<{
    devices: Array<VideoDeviceState>;
    updatedAt: string;
  }> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/video/devices',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Set the power state of a video endpoint.
   * Issue power on or standby commands to a managed display or switcher.
   * @param deviceId
   * @param requestBody
   * @returns any Power command accepted.
   * @throws ApiError
   */
  public static setVideoPower(
    deviceId: string,
    requestBody: {
      power: VideoPowerState;
    },
  ): CancelablePromise<{
    deviceId: string;
    power: VideoPowerState;
    lastUpdated: string;
  }> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/video/devices/{deviceId}/power',
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
      },
    });
  }

  /**
   * Update mute state for a video device.
   * Toggle the audio mute flag for the specified video endpoint.
   * @param deviceId
   * @param requestBody
   * @returns any Mute update accepted.
   * @throws ApiError
   */
  public static setVideoMute(
    deviceId: string,
    requestBody: {
      mute: boolean;
    },
  ): CancelablePromise<{
    deviceId: string;
    mute: boolean;
    lastUpdated: string;
  }> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/video/devices/{deviceId}/mute',
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
      },
    });
  }

  /**
   * Switch the active input on a video device.
   * Change the current input selection on a display or receiver.
   * @param deviceId
   * @param requestBody
   * @returns any Input change accepted.
   * @throws ApiError
   */
  public static setVideoInput(
    deviceId: string,
    requestBody: {
      input: string;
    },
  ): CancelablePromise<{
    deviceId: string;
    input: string;
    lastUpdated: string;
  }> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/video/devices/{deviceId}/input',
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
      },
    });
  }

  /**
   * Request an export of a recording clip for download.
   * Submit an export intent for a recorded segment, returning tracking metadata and a download URL when ready.
   * @param recordingId
   * @param requestBody
   * @returns VideoClipExport Export request accepted.
   * @throws ApiError
   */
  public static exportVideoClip(
    recordingId: string,
    requestBody: {
      startOffsetSeconds: number;
      endOffsetSeconds: number;
    },
  ): CancelablePromise<VideoClipExport> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/video/recordings/{recordingId}/export',
      path: {
        'recordingId': recordingId,
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
      },
    });
  }

  /**
   * Retrieve recording segments for the active video source.
   * Retrieve recording segments for the active video source.
   * @returns any Recording segments available for playback.
   * @throws ApiError
   */
  public static getVideoRecordings(): CancelablePromise<{
    items: Array<VideoRecordingSegment>;
    total: number;
    generatedAt: string;
  }> {
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
   * @returns VideoPreviewSession Signed preview stream URL.
   * @throws ApiError
   */
  public static generateVideoPreview(
    requestBody?: VideoPreviewRequest,
  ): CancelablePromise<VideoPreviewSession> {
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
