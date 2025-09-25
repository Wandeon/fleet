/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AudioDeviceSnapshot } from '../models/AudioDeviceSnapshot';
import type { AudioLibraryTrack } from '../models/AudioLibraryTrack';
import type { AudioMasterVolumeRequest } from '../models/AudioMasterVolumeRequest';
import type { AudioPlaybackRequest } from '../models/AudioPlaybackRequest';
import type { AudioPlaylist } from '../models/AudioPlaylist';
import type { AudioSeekRequest } from '../models/AudioSeekRequest';
import type { AudioState } from '../models/AudioState';
import type { AudioVolumeRequest } from '../models/AudioVolumeRequest';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class AudioService {

  /**
   * Retrieve consolidated audio state including devices, playlists, and sessions.
   * Retrieve consolidated audio state including devices, playlists, and sessions.
   * @returns AudioState Audio overview payload for the operator UI.
   * @throws ApiError
   */
  public static getAudioOverview(): CancelablePromise<AudioState> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/audio/overview',
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
   * Upload a new track to the audio library.
   * Upload a new track to the audio library.
   * @param formData
   * @returns AudioLibraryTrack Track successfully uploaded.
   * @throws ApiError
   */
  public static uploadAudioTrack(
    formData: {
      file: Blob;
      title: string;
      artist?: string;
      /**
       * Comma-separated tags applied to the track.
       */
      tags?: string;
      durationSeconds?: number;
    },
  ): CancelablePromise<AudioLibraryTrack> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/audio/library',
      formData: formData,
      mediaType: 'multipart/form-data',
      errors: {
        400: `One or more request parameters failed validation.`,
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        413: `Uploaded file exceeds allowed limits.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

  /**
   * Create a new audio playlist.
   * Create a new audio playlist.
   * @param requestBody
   * @returns AudioPlaylist Playlist created.
   * @throws ApiError
   */
  public static createAudioPlaylist(
    requestBody: AudioPlaylist,
  ): CancelablePromise<AudioPlaylist> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/audio/playlists',
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
   * Update an existing audio playlist.
   * Update an existing audio playlist.
   * @param playlistId
   * @param requestBody
   * @returns AudioPlaylist Updated playlist definition.
   * @throws ApiError
   */
  public static updateAudioPlaylist(
    playlistId: string,
    requestBody: AudioPlaylist,
  ): CancelablePromise<AudioPlaylist> {
    return __request(OpenAPI, {
      method: 'PUT',
      url: '/audio/playlists/{playlistId}',
      path: {
        'playlistId': playlistId,
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
   * Delete an existing audio playlist.
   * Delete an existing audio playlist.
   * @param playlistId
   * @returns void
   * @throws ApiError
   */
  public static deleteAudioPlaylist(
    playlistId: string,
  ): CancelablePromise<void> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/audio/playlists/{playlistId}',
      path: {
        'playlistId': playlistId,
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
   * Initiate playback across one or more audio devices.
   * Initiate playback across one or more audio devices.
   * @param requestBody
   * @returns any Playback request accepted.
   * @throws ApiError
   */
  public static startAudioPlayback(
    requestBody: AudioPlaybackRequest,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/audio/playback',
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
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

  /**
   * Retrieve the latest snapshot for an individual audio device.
   * Retrieve the latest snapshot for an individual audio device.
   * @param deviceId
   * @returns AudioDeviceSnapshot Current device snapshot.
   * @throws ApiError
   */
  public static getAudioDevice(
    deviceId: string,
  ): CancelablePromise<AudioDeviceSnapshot> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/audio/devices/{deviceId}',
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
   * Pause playback on an audio device.
   * Pause playback on an audio device.
   * @param deviceId
   * @returns any Pause command accepted.
   * @throws ApiError
   */
  public static pauseAudioDevice(
    deviceId: string,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/audio/devices/{deviceId}/pause',
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

  /**
   * Resume playback on an audio device.
   * Resume playback on an audio device.
   * @param deviceId
   * @returns any Resume command accepted.
   * @throws ApiError
   */
  public static resumeAudioDevice(
    deviceId: string,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/audio/devices/{deviceId}/resume',
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

  /**
   * Stop playback on an audio device.
   * Stop playback on an audio device.
   * @param deviceId
   * @returns any Stop command accepted.
   * @throws ApiError
   */
  public static stopAudioDevice(
    deviceId: string,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/audio/devices/{deviceId}/stop',
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

  /**
   * Seek to a position in the currently playing track.
   * Seek to a position in the currently playing track.
   * @param deviceId
   * @param requestBody
   * @returns any Seek command accepted.
   * @throws ApiError
   */
  public static seekAudioDevice(
    deviceId: string,
    requestBody: AudioSeekRequest,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/audio/devices/{deviceId}/seek',
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
   * Set the volume for an audio device.
   * Set the volume for an audio device.
   * @param deviceId
   * @param requestBody
   * @returns any Volume update accepted.
   * @throws ApiError
   */
  public static setAudioDeviceVolume(
    deviceId: string,
    requestBody: AudioVolumeRequest,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/audio/devices/{deviceId}/volume',
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
   * Set the global master volume for audio playback.
   * Set the global master volume for audio playback.
   * @param requestBody
   * @returns any Master volume update accepted.
   * @throws ApiError
   */
  public static setAudioMasterVolume(
    requestBody: AudioMasterVolumeRequest,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/audio/master-volume',
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

}
