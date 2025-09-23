/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CameraStorageSummary } from './CameraStorageSummary';
import type { CameraSummaryItem } from './CameraSummaryItem';

export type CameraSummary = {
  cameras: Array<CameraSummaryItem>;
  storage: CameraStorageSummary;
};

