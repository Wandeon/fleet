/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type CameraStream = {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'degraded';
  reason?: string | null;
  streamUrl?: string | null;
  module?: string | null;
  updatedAt: string;
};

