/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioDevicePlayback } from './AudioDevicePlayback';
import type { DeviceStatus } from './DeviceStatus';

export type AudioDeviceSnapshot = {
  id: string;
  name: string;
  status: DeviceStatus;
  group?: string | null;
  /**
   * Percent-based volume control, aligned with 1 dB steps in Pi devices.
   */
  volumePercent: number;
  /**
   * Capabilities exposed by the device. Values map to the live device capabilities matrix.
   */
  capabilities: Array<string>;
  playback: AudioDevicePlayback;
  lastUpdated: string;
};

