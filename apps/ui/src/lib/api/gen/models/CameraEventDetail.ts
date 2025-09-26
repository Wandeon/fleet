/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CameraEvent } from './CameraEvent';
import type { CameraEventClip } from './CameraEventClip';

export type CameraEventDetail = (CameraEvent & {
  metadata: any;
  clip: CameraEventClip;
});

