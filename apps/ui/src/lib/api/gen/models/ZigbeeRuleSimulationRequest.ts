/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ZigbeeRuleDefinition } from './ZigbeeRuleDefinition';

/**
 * Provide either an existing ruleId or a full definition to simulate.
 */
export type ZigbeeRuleSimulationRequest = {
  ruleId?: string;
  definition?: ZigbeeRuleDefinition;
  input?: Record<string, any>;
};
