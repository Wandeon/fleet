/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type FleetDeviceAction = {
  id: string;
  label: string;
  description?: string | null;
  group: 'audio' | 'video' | 'system' | 'network' | 'maintenance';
  method: 'POST' | 'PATCH' | 'DELETE';
  endpoint: string;
  requiresConfirmation?: boolean | null;
};
