/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type LogsExportResponse = {
  exportId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  format: 'json' | 'csv';
  filters: {
    deviceId?: string | null;
    level?: string | null;
    start?: string | null;
    end?: string | null;
  };
  requestedAt: string;
  estimatedReadyAt: string;
  downloadUrl: string;
  correlationId?: string | null;
};

