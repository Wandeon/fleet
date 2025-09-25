/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type PairingHistoryEntry = {
  id: string;
  completedAt: string;
  deviceId: string;
  status: 'success' | 'error';
  note?: string | null;
};

