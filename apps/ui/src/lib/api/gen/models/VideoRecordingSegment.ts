/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type VideoRecordingSegment = {
  id: string;
  deviceId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  status: 'available' | 'processing' | 'failed';
};
