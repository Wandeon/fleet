/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type AudioPlaylistTrack = {
  trackId: string;
  order: number;
  startOffsetSeconds?: number | null;
  deviceOverrides?: Record<string, string> | null;
};

