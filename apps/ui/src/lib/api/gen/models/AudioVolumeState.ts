/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type AudioVolumeState = {
  level: number;
  /**
   * Whether the device volume is currently hardware locked.
   */
  locked?: boolean;
  lastChangedBy?: string | null;
};

