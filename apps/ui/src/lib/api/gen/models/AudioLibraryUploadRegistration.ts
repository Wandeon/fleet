/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AudioSyncMode } from './AudioSyncMode';

export type AudioLibraryUploadRegistration = {
  uploadId: string;
  filename: string;
  contentType: string;
  sizeBytes?: number | null;
  title?: string | null;
  artist?: string | null;
  tags?: Array<string>;
  metadata?: Record<string, string> | null;
  uploadUrl: string;
  expiresAt: string;
  fields?: Record<string, string>;
  syncMode?: AudioSyncMode;
  resume?: boolean;
  startAtSeconds?: number;
  loop?: boolean;
};

