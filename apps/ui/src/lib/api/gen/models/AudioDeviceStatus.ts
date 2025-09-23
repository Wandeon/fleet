/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioConfigState } from './AudioConfigState';
import type { AudioPlaybackState } from './AudioPlaybackState';
import type { AudioVolumeState } from './AudioVolumeState';

export type AudioDeviceStatus = {
  id: string;
  displayName: string;
  online: boolean;
  playback: AudioPlaybackState;
  volume: AudioVolumeState;
  lastSeen: string;
  /**
   * Supported control surfaces exposed by the device.
   */
  capabilities?: Array<string>;
  config?: AudioConfigState;
};

