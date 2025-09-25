/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioPlaybackAssignment } from './AudioPlaybackAssignment';
import type { AudioSyncMode } from './AudioSyncMode';

export type AudioPlaybackRequest = {
  deviceIds: Array<string>;
  playlistId?: string | null;
  trackId?: string | null;
  assignments?: Array<AudioPlaybackAssignment>;
  syncMode: AudioSyncMode;
  resume?: boolean;
  startAtSeconds?: number;
  loop?: boolean;
};

