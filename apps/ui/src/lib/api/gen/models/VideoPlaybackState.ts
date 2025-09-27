/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type VideoPlaybackState = {
  status: 'idle' | 'playing' | 'paused' | 'stopped';
  source: string | null;
  startedAt: string | null;
};

