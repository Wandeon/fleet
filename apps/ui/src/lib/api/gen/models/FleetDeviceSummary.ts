/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { DeviceStatus } from './DeviceStatus';

export type FleetDeviceSummary = {
  id: string;
  name: string;
  role: string;
  module: string;
  status: DeviceStatus;
  location?: string | null;
  lastSeen: string;
  uptime: string;
  ipAddress: string;
  version: string;
  groups: Array<string>;
  tags: Array<string>;
  capabilities: Array<string>;
};

