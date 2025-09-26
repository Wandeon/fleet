/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ZigbeeDevice = {
  id: string;
  name: string;
  type: string;
  state: 'open' | 'closed' | 'active' | 'inactive';
  lastSeen: string;
  battery?: number | null;
};
