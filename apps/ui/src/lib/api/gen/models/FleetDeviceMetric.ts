/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type FleetDeviceMetric = {
  id: string;
  label: string;
  value: string;
  unit?: string | null;
  status: 'ok' | 'warn' | 'error';
  trend?: 'up' | 'down' | 'steady' | null;
  updatedAt?: string | null;
  description?: string | null;
};
