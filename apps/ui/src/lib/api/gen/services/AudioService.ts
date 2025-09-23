/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AudioConfigRequest } from '../models/AudioConfigRequest';
import type { AudioConfigResponse } from '../models/AudioConfigResponse';
import type { AudioDeviceList } from '../models/AudioDeviceList';
import type { AudioDeviceStatus } from '../models/AudioDeviceStatus';
import type { AudioPlayRequest } from '../models/AudioPlayRequest';
import type { AudioStopResponse } from '../models/AudioStopResponse';
import type { AudioVolumeRequest } from '../models/AudioVolumeRequest';
import type { AudioVolumeResponse } from '../models/AudioVolumeResponse';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class AudioService {

  /**
   * List registered audio devices.
   * Returns a paginated list of audio players and their latest telemetry.
   * @param limit Maximum number of results to return.
   * @param cursor Opaque pagination cursor returned by previous responses.
   * @returns AudioDeviceList Collection of audio devices.
   * @throws ApiError
   */
  public static listAudioDevices(
    limit: number = 50,
    cursor?: string,
  ): CancelablePromise<AudioDeviceList> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/audio/devices',
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
   * Retrieve status for a specific audio device.
   * Fetches the real-time playback, volume, and connectivity status for a single audio player.
   * @param id Audio device identifier.
   * @returns AudioDeviceStatus Current device status.
   * @throws ApiError
   */
  public static getAudioDevice(
    id: string,
  ): CancelablePromise<AudioDeviceStatus> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/audio/{id}',
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

  /**
   * Start playback on an audio device.
   * Requests the player to begin playback from either the live stream or cached fallback file.
   * @param id
   * @param requestBody
   * @returns AudioDeviceStatus Updated device status after triggering playback.
   * @throws ApiError
   */
  public static playAudioDevice(
    id: string,
    requestBody: AudioPlayRequest,
  ): CancelablePromise<AudioDeviceStatus> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/audio/{id}/play',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        401: `Authentication credentials missing or invalid.`,
        403: `Authenticated user lacks required scope.`,
        404: `Requested resource could not be found.`,
        409: `Device busy and cannot accept playback command.`,
        422: `Request payload failed validation.`,
        429: `Request rate limit exceeded.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

  /**
   * Stop playback on an audio device.
   * Immediately halts playback and reports the resulting idle state for the device.
   * @param id
   * @returns AudioStopResponse Playback halted.
   * @throws ApiError
   */
  public static stopAudioDevice(
    id: string,
  ): CancelablePromise<AudioStopResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/audio/{id}/stop',
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

  /**
   * Adjust playback volume for an audio device.
   * Sets the absolute gain multiplier on the target player (0.0–2.0 range).
   * @param id
   * @param requestBody
   * @returns AudioVolumeResponse Updated device volume state.
   * @throws ApiError
   */
  public static setAudioDeviceVolume(
    id: string,
    requestBody: AudioVolumeRequest,
  ): CancelablePromise<AudioVolumeResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/audio/{id}/volume',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        401: `Authentication credentials missing or invalid.`,
        403: `Authenticated user lacks required scope.`,
        404: `Requested resource could not be found.`,
        422: `Request payload failed validation.`,
        429: `Request rate limit exceeded.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

  /**
   * Update persistent configuration for an audio device.
   * Persists stream URLs, fallback behaviour, and default source selection for a player.
   * @param id
   * @param requestBody
   * @returns AudioConfigResponse Updated device configuration and status.
   * @throws ApiError
   */
  public static updateAudioDeviceConfig(
    id: string,
    requestBody: AudioConfigRequest,
  ): CancelablePromise<AudioConfigResponse> {
    return __request(OpenAPI, {
      method: 'PUT',
      url: '/audio/{id}/config',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        401: `Authentication credentials missing or invalid.`,
        403: `Authenticated user lacks required scope.`,
        404: `Requested resource could not be found.`,
        409: `Device busy updating configuration.`,
        422: `Request payload failed validation.`,
        429: `Request rate limit exceeded.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

}
