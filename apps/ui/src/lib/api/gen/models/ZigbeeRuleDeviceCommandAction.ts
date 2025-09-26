/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ZigbeeRuleDeviceCommandAction = {
  type: 'ZigbeeRuleDeviceCommandAction';
  deviceId: string;
  command: string;
  payload?: Record<string, any>;
};
