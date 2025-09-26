/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type AudioLibraryUploadRegistrationRequest = {
  filename: string;
  contentType?: string;
  sizeBytes?: number;
  title?: string | null;
  artist?: string | null;
  tags?: Array<string>;
  metadata?: Record<string, string> | null;
};
