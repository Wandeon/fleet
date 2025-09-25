/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CameraEventDetection } from './CameraEventDetection';

export type CameraEvent = {
  id: string;
  cameraId: string;
  timestamp: string;
  description: string;
  severity: 'info' | 'warning' | 'alert' | 'error';
  clipUrl?: string | null;
  snapshotUrl?: string | null;
  acknowledged?: boolean | null;
  detections?: Array<CameraEventDetection>;
  tags?: Array<string>;
};

