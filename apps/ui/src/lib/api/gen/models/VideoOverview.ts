/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { VideoDeviceState } from './VideoDeviceState';

export type VideoOverview = {
  devices: Array<VideoDeviceState>;
  total: number;
  online: number;
  updatedAt: string;
};
