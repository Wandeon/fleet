/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ZigbeeRuleAction } from './ZigbeeRuleAction';
import type { ZigbeeRuleTrigger } from './ZigbeeRuleTrigger';

export type ZigbeeRuleUpdateRequest = {
  name?: string;
  description?: string | null;
  trigger?: ZigbeeRuleTrigger;
  actions?: Array<ZigbeeRuleAction>;
  tags?: Array<string>;
  metadata?: Record<string, any>;
  enabled?: boolean;
};

