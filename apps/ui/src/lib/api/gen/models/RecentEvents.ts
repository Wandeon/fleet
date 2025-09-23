/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { RecentEvent } from './RecentEvent';

export type RecentEvents = {
  items: Array<RecentEvent>;
  nextCursor?: string | null;
};

