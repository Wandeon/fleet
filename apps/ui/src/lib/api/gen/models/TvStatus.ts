/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type TvStatus = {
  id: string;
  displayName: string;
  online: boolean;
  power: 'on' | 'off';
  input: string;
  availableInputs?: Array<string>;
  volume: number;
  mute: boolean;
  lastSeen: string;
};

