/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type AudioSessionSyncRequest = {
  referenceTimestamp: string;
  maxDriftSeconds: number;
  perDevice: Record<string, number>;
  correctionsApplied?: boolean;
};

