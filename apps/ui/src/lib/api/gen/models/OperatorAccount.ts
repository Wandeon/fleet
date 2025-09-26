/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { OperatorRole } from './OperatorRole';

export type OperatorAccount = {
  id: string;
  email: string;
  roles: Array<OperatorRole>;
  invitedAt: string | null;
  status: 'active' | 'pending' | 'suspended';
  lastUpdatedAt: string;
};
