/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type RecentEvent = {
  id: string;
  source: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  summary?: string | null;
};

