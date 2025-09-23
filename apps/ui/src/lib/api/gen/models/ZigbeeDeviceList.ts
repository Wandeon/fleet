/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ZigbeeDeviceSummary } from './ZigbeeDeviceSummary';

export type ZigbeeDeviceList = {
  items: Array<ZigbeeDeviceSummary>;
  nextCursor?: string | null;
};

