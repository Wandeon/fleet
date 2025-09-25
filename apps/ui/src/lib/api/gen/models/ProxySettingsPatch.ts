/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ProxySettingsPatch = {
  baseUrl?: string;
  timeoutMs?: number;
  health?: 'online' | 'degraded' | 'offline';
  latencyMs?: number;
  errorRate?: number;
};

