/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { OperatorAccount } from './OperatorAccount';

export type OperatorListResponse = {
  items: Array<OperatorAccount>;
  total: number;
  updatedAt: string;
};

