/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

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
};

