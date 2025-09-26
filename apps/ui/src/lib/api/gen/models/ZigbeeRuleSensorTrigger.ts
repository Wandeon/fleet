/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ZigbeeRuleCondition } from './ZigbeeRuleCondition';

export type ZigbeeRuleSensorTrigger = {
  type: 'ZigbeeRuleSensorTrigger';
  sensorId: string;
  event: string;
  condition?: ZigbeeRuleCondition;
  cooldownSeconds?: number;
};
