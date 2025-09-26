/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ZigbeeRuleExpressionTrigger = {
  type: 'ZigbeeRuleExpressionTrigger';
  /**
   * JavaScript expression evaluated in the automation sandbox.
   */
  expression: string;
  language?: 'js';
  description?: string;
};
