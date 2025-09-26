/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ZigbeeRuleSimulationEvaluation = {
  triggerType: string;
  reason: string;
  error?: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
};
