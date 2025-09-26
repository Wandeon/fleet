/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ZigbeeActionRequest = {
  deviceId: string;
  command: string;
  payload?: Record<string, string>;
};
