/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ZigbeeRuleDefinition } from './ZigbeeRuleDefinition';

export type ZigbeeRuleValidationResponse = {
  valid: boolean;
  normalized: ZigbeeRuleDefinition;
  evaluatedAt: string;
};
