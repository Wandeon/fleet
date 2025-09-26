/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ZigbeeRuleScheduleTrigger = {
  type: 'ZigbeeRuleScheduleTrigger';
  /**
   * Cron expression evaluated by the hub scheduler.
   */
  cron: string;
  /**
   * IANA timezone identifier used for the cron expression.
   */
  timezone?: string;
};

