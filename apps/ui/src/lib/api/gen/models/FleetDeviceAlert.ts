/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type FleetDeviceAlert = {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  createdAt: string;
  acknowledged: boolean;
};
