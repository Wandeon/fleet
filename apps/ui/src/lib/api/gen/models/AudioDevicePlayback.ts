/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioPlaybackStateName } from './AudioPlaybackStateName';

export type AudioDevicePlayback = {
  state: AudioPlaybackStateName;
  trackId?: string | null;
  trackTitle?: string | null;
  playlistId?: string | null;
  positionSeconds: number;
  durationSeconds: number;
  startedAt: string | null;
  syncGroup: string | null;
  lastError?: string | null;
};
