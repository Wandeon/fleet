/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type SettingsPairingState = {
  active: boolean;
  expiresAt: string | null;
  ticketId: string | null;
  candidates: Array<{
    id: string;
    model: string;
    signal: number;
  }>;
};
