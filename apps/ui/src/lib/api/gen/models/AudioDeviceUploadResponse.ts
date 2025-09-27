/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioSyncMode } from './AudioSyncMode';

export type AudioDeviceUploadResponse = {
  /**
   * Identifier of the audio device that processed the upload.
   */
  deviceId: string;
  /**
   * Indicates whether the device persisted the uploaded file.
   */
  saved: boolean;
  /**
   * Absolute path reported by the device for the stored fallback asset.
   */
  path: string;
  /**
   * Flag reflecting whether the device reports an on-disk fallback file after the upload.
   */
  fallbackExists: boolean;
  /**
   * Raw status payload returned from the device following the upload.
   */
  status?: {
    stream_url: string;
    volume: number;
    mode: 'auto' | 'manual';
    source: 'stream' | 'file' | 'stop';
    fallback_exists: boolean;
  };
  fields?: Record<string, string>;
  syncMode?: AudioSyncMode;
  resume?: boolean;
  startAtSeconds?: number;
  loop?: boolean;
};

