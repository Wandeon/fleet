/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type CameraPreviewState = {
  cameraId: string | null;
  status: 'ready' | 'pending' | 'unavailable';
  posterUrl: string | null;
  streamUrl: string | null;
  reason?: string | null;
  updatedAt: string;
};
