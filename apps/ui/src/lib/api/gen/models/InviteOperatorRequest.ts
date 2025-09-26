/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { OperatorRole } from './OperatorRole';

export type InviteOperatorRequest = {
  email: string;
  roles: Array<OperatorRole>;
};
