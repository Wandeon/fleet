/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioDeviceStatus } from './AudioDeviceStatus';

export type AudioDeviceList = {
  items: Array<AudioDeviceStatus>;
  nextCursor?: string | null;
};

