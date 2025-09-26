/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioPlaylistTrack } from './AudioPlaylistTrack';
import type { AudioSyncMode } from './AudioSyncMode';

export type AudioPlaylist = {
  id: string;
  name: string;
  description?: string | null;
  loop: boolean;
  syncMode: AudioSyncMode;
  createdAt: string;
  updatedAt: string;
  tracks: Array<AudioPlaylistTrack>;
};
