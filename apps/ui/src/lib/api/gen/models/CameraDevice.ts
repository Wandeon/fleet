/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { DeviceStatus } from './DeviceStatus';

export type CameraDevice = {
  id: string;
  name: string;
  status: DeviceStatus;
  location?: string | null;
  streamUrl?: string | null;
  stillUrl?: string | null;
  lastHeartbeat: string;
  /**
   * Capabilities correspond to AI camera features documented in the device matrix.
   */
  capabilities: Array<string>;
};
