/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type CameraEvent = {
  id: string;
  cameraId: string;
  type: string;
  severity?: 'info' | 'warning' | 'critical';
  timestamp: string;
  clipUrl?: string | null;
  thumbnailUrl?: string | null;
  synopsis?: string | null;
};

