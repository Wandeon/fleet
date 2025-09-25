/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { VideoPowerState } from './VideoPowerState';

export type VideoCecDevice = {
  id: string;
  name: string;
  power: VideoPowerState;
  input?: string | null;
};

