/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ZigbeeDeviceSummary = {
  id: string;
  displayName: string;
  type: string;
  state: string;
  batteryPercent?: number | null;
  lastSeen?: string;
};

