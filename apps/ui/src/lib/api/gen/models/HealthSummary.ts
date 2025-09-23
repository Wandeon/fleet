/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ModuleHealth } from './ModuleHealth';

export type HealthSummary = {
  status: 'healthy' | 'degraded' | 'down';
  updatedAt: string;
  modules: Array<ModuleHealth>;
};

