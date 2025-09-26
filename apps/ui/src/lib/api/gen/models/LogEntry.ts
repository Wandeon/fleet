/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type LogEntry = {
  timestamp: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  meta?: Record<string, string> | null;
  correlationId?: string | null;
  context?: any;
};
