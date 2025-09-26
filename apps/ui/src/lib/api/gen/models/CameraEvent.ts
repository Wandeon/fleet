/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type CameraEvent = {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  confidence: number;
  tags: Array<string>;
  thumbnailUrl?: string | null;
  clipUrl?: string | null;
  clipAvailable: boolean;
  acknowledged: boolean;
  acknowledgedAt?: string | null;
};
