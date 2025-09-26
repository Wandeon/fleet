/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type VideoClipExport = {
  exportId: string;
  recordingId: string;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  startOffsetSeconds: number;
  endOffsetSeconds: number;
  requestedAt: string;
  downloadUrl: string;
};

