/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type CameraOverviewSummary = {
  status: 'online' | 'offline' | 'degraded';
  updatedAt: string;
  reason: string | null;
  cameras: Array<{
    id: string;
    name: string;
    status: 'online' | 'offline' | 'degraded';
    lastSeen?: string | null;
    reason?: string | null;
  }>;
};

