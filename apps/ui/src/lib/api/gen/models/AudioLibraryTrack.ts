/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type AudioLibraryTrack = {
  id: string;
  title: string;
  artist?: string | null;
  durationSeconds: number;
  /**
   * Media container or codec (e.g. MP3, AAC, FLAC) supported per the device matrix.
   */
  format: string;
  sizeBytes?: number | null;
  tags?: Array<string>;
  uploadedAt: string;
};

