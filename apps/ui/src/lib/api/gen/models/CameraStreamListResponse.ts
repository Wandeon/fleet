/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CameraStream } from './CameraStream';

export type CameraStreamListResponse = {
  streams: Array<CameraStream>;
  total: number;
  updatedAt: string;
};

