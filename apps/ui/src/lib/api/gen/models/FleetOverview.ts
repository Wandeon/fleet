/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { FleetDeviceSummary } from './FleetDeviceSummary';

export type FleetOverview = {
  totals: {
    devices: number;
    online: number;
    offline: number;
    degraded: number;
  };
  modules: Array<{
    id: string;
    label: string;
    online: number;
    offline: number;
    degraded: number;
  }>;
  devices: Array<FleetDeviceSummary>;
  updatedAt: string;
};

