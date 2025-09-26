/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type VideoPreviewSession = {
  sessionId: string;
  streamUrl: string;
  expiresAt: string;
  device?: {
    id?: string;
    name?: string;
    input?: string;
  } | null;
};

