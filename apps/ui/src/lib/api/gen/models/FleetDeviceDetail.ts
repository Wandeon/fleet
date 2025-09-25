/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { FleetDeviceAction } from './FleetDeviceAction';
import type { FleetDeviceAlert } from './FleetDeviceAlert';
import type { FleetDeviceMetric } from './FleetDeviceMetric';
import type { FleetDeviceSummary } from './FleetDeviceSummary';
import type { LogEntry } from './LogEntry';

export type FleetDeviceDetail = {
  summary: FleetDeviceSummary;
  metrics: Array<FleetDeviceMetric>;
  alerts: Array<FleetDeviceAlert>;
  logs: Array<LogEntry>;
  actions: Array<FleetDeviceAction>;
  connections: Array<{
    name: string;
    status: 'connected' | 'pending' | 'error';
    lastChecked: string;
  }>;
};

