/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioSessionDrift } from './AudioSessionDrift';
import type { AudioSyncMode } from './AudioSyncMode';

export type AudioSession = {
  id: string;
  playlistId?: string | null;
  trackId?: string | null;
  deviceIds: Array<string>;
  syncMode: AudioSyncMode;
  state: 'preparing' | 'playing' | 'paused' | 'completed' | 'error';
  startedAt: string;
  lastError?: string | null;
  drift?: AudioSessionDrift;
};
