/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioDeviceStatus } from './AudioDeviceStatus';
import type { CameraStateSummary } from './CameraStateSummary';
import type { TvStatus } from './TvStatus';
import type { ZigbeeStateSummary } from './ZigbeeStateSummary';

export type FleetState = {
  generatedAt: string;
  audio: {
    devices: Array<AudioDeviceStatus>;
  };
  video: {
    tv: TvStatus;
  };
  zigbee: ZigbeeStateSummary;
  camera: CameraStateSummary;
};

