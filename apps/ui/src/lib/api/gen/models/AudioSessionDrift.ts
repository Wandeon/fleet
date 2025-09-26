/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type AudioSessionDrift = {
  referenceTimestamp?: string | null;
  maxDriftSeconds: number;
  perDevice: Record<string, number>;
  correctionsApplied?: boolean;
};
