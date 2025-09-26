/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ZigbeeRuleDefinition } from './ZigbeeRuleDefinition';

export type ZigbeeRule = ZigbeeRuleDefinition & {
  id: string;
  createdAt: string;
  updatedAt: string;
  description?: string | null;
  metadata?: Record<string, any>;
  tags?: Array<string>;
};
