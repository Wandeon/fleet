/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioDeviceSnapshot } from './AudioDeviceSnapshot';
import type { AudioLibraryTrack } from './AudioLibraryTrack';
import type { AudioPlaylist } from './AudioPlaylist';
import type { AudioSession } from './AudioSession';

export type AudioState = {
  masterVolume: number;
  devices: Array<AudioDeviceSnapshot>;
  library: Array<AudioLibraryTrack>;
  playlists: Array<AudioPlaylist>;
  sessions: Array<AudioSession>;
  message?: string | null;
};

