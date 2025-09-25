/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioSyncMode } from './AudioSyncMode';

export type AudioSession = {
  id: string;
  playlistId?: string | null;
  deviceIds: Array<string>;
  syncMode: AudioSyncMode;
  state: 'preparing' | 'playing' | 'paused' | 'completed' | 'error';
  startedAt: string;
};

