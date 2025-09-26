/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type LogsExportRequest = {
  deviceId?: string;
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  start?: string;
  end?: string;
  format?: 'json' | 'csv';
};

