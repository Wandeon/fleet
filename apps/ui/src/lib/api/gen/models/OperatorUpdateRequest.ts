/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { OperatorRole } from './OperatorRole';

export type OperatorUpdateRequest = {
  roles?: Array<OperatorRole>;
  status?: 'pending' | 'active' | 'suspended';
};

