/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CameraEvent } from './CameraEvent';

export type CameraEventListResponse = {
  events: Array<CameraEvent>;
  pagination: {
    total: number;
    limit: number;
    nextCursor?: string | null;
    hasMore: boolean;
  };
  filters?: {
    cameraId?: string | null;
    start?: string | null;
    end?: string | null;
    tags?: Array<string>;
    minConfidence?: number | null;
    maxConfidence?: number | null;
  } | null;
  generatedAt: string;
};
