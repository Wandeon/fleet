/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ZigbeeRuleCondition = {
  /**
   * JSON pointer-style path evaluated against the trigger context payload.
   */
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'includes' | 'excludes';
  value: string | number | boolean;
};
