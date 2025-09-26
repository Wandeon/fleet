/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ZigbeeDevice } from './ZigbeeDevice';
import type { ZigbeePairingState } from './ZigbeePairingState';

export type ZigbeeState = {
  devices: Array<ZigbeeDevice>;
  hub: {
    id: string;
    status: string;
    channel: number;
    lastHeartbeatAt: string;
  };
  pairing: ZigbeePairingState;
  rules: Array<{
    id: string;
    name: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
};

