/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ProxySettings = {
  upstreamUrl: string;
  authMode: 'none' | 'basic' | 'token';
  heartbeatIntervalSeconds: number;
};
