/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ZigbeeRuleAction } from './ZigbeeRuleAction';
import type { ZigbeeRuleTrigger } from './ZigbeeRuleTrigger';

export type ZigbeeRuleDefinition = {
  name: string;
  description?: string;
  trigger: ZigbeeRuleTrigger;
  actions: Array<ZigbeeRuleAction>;
  tags?: Array<string>;
  metadata?: Record<string, any>;
  enabled?: boolean;
};

