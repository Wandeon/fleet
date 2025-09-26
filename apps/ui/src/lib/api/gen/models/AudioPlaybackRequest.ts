/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioPlaybackAssignment } from './AudioPlaybackAssignment';

export type AudioPlaybackRequest = {
  deviceIds: Array<string>;
  playlistId?: string | null;
  trackId?: string | null;
  assignments?: Array<AudioPlaybackAssignment>;
};
