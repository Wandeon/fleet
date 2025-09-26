/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type LogSource = {
  id: string;
  label: string;
  description?: string | null;
  kind: 'device' | 'service' | 'system' | 'group';
  module?: string | null;
  deviceId?: string | null;
  active?: boolean | null;
};
