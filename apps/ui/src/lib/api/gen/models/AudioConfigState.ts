/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type AudioConfigState = {
  streamUrl?: string | null;
  /**
   * Device operating mode.
   */
  mode?: string | null;
  defaultSource?: 'stream' | 'file' | null;
};

