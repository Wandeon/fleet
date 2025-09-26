/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type OperatorAccount = {
  id: string;
  email: string;
  roles: Array<string>;
  invitedAt: string | null;
  status: 'active' | 'pending' | 'removed';
};

