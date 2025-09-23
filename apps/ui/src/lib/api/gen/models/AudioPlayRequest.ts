/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type AudioPlayRequest = {
  source: 'stream' | 'file';
  /**
   * Resume previous playback position when available.
   */
  resume?: boolean;
};

