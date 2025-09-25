/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { PairingDiscoveryCandidate } from './PairingDiscoveryCandidate';
import type { PairingHistoryEntry } from './PairingHistoryEntry';

export type PairingStatus = {
  active: boolean;
  method: 'manual' | 'qr' | 'auto';
  expiresAt: string | null;
  discovered: Array<PairingDiscoveryCandidate>;
  history: Array<PairingHistoryEntry>;
};

