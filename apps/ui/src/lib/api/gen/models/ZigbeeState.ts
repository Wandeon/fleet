/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { DeviceStatus } from './DeviceStatus';
import type { ZigbeeDevice } from './ZigbeeDevice';
import type { ZigbeePairingState } from './ZigbeePairingState';
import type { ZigbeeQuickAction } from './ZigbeeQuickAction';

export type ZigbeeState = {
  devices: Array<ZigbeeDevice>;
  quickActions: Array<ZigbeeQuickAction>;
  hubStatus: DeviceStatus;
  /**
   * Active pairing state if pairing mode is engaged; null otherwise.
   */
  pairing?: ZigbeePairingState | null;
};

