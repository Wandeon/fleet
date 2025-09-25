/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type VideoLiveStream = {
  deviceId: string;
  streamUrl: string;
  thumbnailUrl?: string | null;
  startedAt: string;
  latencyMs: number;
  status: 'ready' | 'connecting' | 'error';
};

