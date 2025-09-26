/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ZigbeeRule } from './ZigbeeRule';
import type { ZigbeeRuleAction } from './ZigbeeRuleAction';
import type { ZigbeeRuleSimulationEvaluation } from './ZigbeeRuleSimulationEvaluation';

export type ZigbeeRuleSimulationResponse = {
  matched: boolean;
  actions: Array<ZigbeeRuleAction>;
  rule: ZigbeeRule;
  evaluation: ZigbeeRuleSimulationEvaluation;
};

