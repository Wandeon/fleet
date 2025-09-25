/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { VideoCecDevice } from './VideoCecDevice';
import type { VideoInputOption } from './VideoInputOption';
import type { VideoLiveStream } from './VideoLiveStream';
import type { VideoPowerState } from './VideoPowerState';
import type { VideoRecordingSegment } from './VideoRecordingSegment';

export type VideoState = {
  power: VideoPowerState;
  input: string;
  availableInputs: Array<VideoInputOption>;
  /**
   * Most recent live stream snapshot or null when no preview is available.
   */
  livePreview?: VideoLiveStream | null;
  recordings: Array<VideoRecordingSegment>;
  volume: number;
  muted: boolean;
  lastSignal: string;
  cecDevices: Array<VideoCecDevice>;
};

