/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ZigbeeRuleExpressionTrigger } from './ZigbeeRuleExpressionTrigger';
import type { ZigbeeRuleScheduleTrigger } from './ZigbeeRuleScheduleTrigger';
import type { ZigbeeRuleSensorTrigger } from './ZigbeeRuleSensorTrigger';

export type ZigbeeRuleTrigger = (ZigbeeRuleSensorTrigger | ZigbeeRuleScheduleTrigger | ZigbeeRuleExpressionTrigger);

