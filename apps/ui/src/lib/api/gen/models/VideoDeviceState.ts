/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { VideoPowerState } from './VideoPowerState';

export type VideoDeviceState = {
  id: string;
  name: string;
  module: string;
  role: string;
  status: string;
  power: VideoPowerState;
  mute: boolean;
  input: string;
  lastUpdated: string;
};

