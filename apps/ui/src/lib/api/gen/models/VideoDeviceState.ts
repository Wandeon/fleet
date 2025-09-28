/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { VideoPlaybackState } from './VideoPlaybackState';
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
  volumePercent: number;
  availableInputs: Array<string>;
  playback: VideoPlaybackState;
  busy: boolean;
  lastJobId?: string | null;
  lastUpdated: string;
};

