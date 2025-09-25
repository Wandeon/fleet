/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { LogSeverity } from './LogSeverity';

export type LogEntry = {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  message: string;
  source: string;
  module?: string | null;
  deviceId?: string | null;
  correlationId?: string | null;
  context?: any;
};

