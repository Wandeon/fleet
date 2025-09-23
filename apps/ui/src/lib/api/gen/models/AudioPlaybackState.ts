/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type AudioPlaybackState = {
  /**
   * Current playback state.
   */
  state: 'idle' | 'playing' | 'buffering' | 'error';
  /**
   * Active audio source.
   */
  source: 'stream' | 'file';
  trackTitle?: string | null;
  since?: string | null;
  errorMessage?: string | null;
};

