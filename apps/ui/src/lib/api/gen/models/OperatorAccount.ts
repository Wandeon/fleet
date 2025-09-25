/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type OperatorAccount = {
  id: string;
  name: string;
  email: string;
  roles: Array<string>;
  lastActiveAt: string | null;
  status: 'active' | 'invited' | 'disabled';
};

