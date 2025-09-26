/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ZigbeeRuleNotifyAction = {
  type: 'ZigbeeRuleNotifyAction';
  channel: 'slack' | 'email' | 'sms';
  message: string;
  metadata?: Record<string, any>;
};
