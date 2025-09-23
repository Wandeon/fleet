/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ModuleHealth = {
  id: string;
  status: 'healthy' | 'degraded' | 'down';
  message?: string | null;
};

