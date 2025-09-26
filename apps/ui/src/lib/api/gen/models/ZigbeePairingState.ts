/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ZigbeePairingCandidate } from './ZigbeePairingCandidate';

export type ZigbeePairingState = {
  active: boolean;
  startedAt?: string | null;
  expiresAt?: string | null;
  discovered: Array<ZigbeePairingCandidate>;
  confirmed?: Array<string>;
};
