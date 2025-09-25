/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { LogEntry } from './LogEntry';
import type { LogSource } from './LogSource';

export type LogsSnapshot = {
  entries: Array<LogEntry>;
  sources?: Array<LogSource>;
  cursor?: string | null;
  lastUpdated: string;
};

