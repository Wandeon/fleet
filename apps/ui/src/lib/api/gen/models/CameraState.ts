/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CameraClip } from './CameraClip';
import type { CameraDevice } from './CameraDevice';
import type { CameraEvent } from './CameraEvent';
import type { CameraOverviewSummary } from './CameraOverviewSummary';
import type { CameraPreviewState } from './CameraPreviewState';
import type { DeviceStatus } from './DeviceStatus';

export type CameraState = {
  activeCameraId: string | null;
  devices: Array<CameraDevice>;
  events: Array<CameraEvent>;
  clips: Array<CameraClip>;
  overview: {
    previewImage: string | null;
    streamUrl: string | null;
    lastMotion: string | null;
    health: DeviceStatus;
    updatedAt: string | null;
  };
  /**
   * Optional roll-up of camera health for quick status review.
   */
  summary?: CameraOverviewSummary | null;
  /**
   * Preview metadata for the active camera if a live preview exists.
   */
  preview?: CameraPreviewState | null;
};

