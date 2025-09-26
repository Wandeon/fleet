/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ZigbeeRuleDelayAction } from './ZigbeeRuleDelayAction';
import type { ZigbeeRuleDeviceCommandAction } from './ZigbeeRuleDeviceCommandAction';
import type { ZigbeeRuleNotifyAction } from './ZigbeeRuleNotifyAction';

export type ZigbeeRuleAction =
  | ZigbeeRuleDeviceCommandAction
  | ZigbeeRuleNotifyAction
  | ZigbeeRuleDelayAction;
