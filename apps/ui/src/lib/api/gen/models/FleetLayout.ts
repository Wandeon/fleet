/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { LayoutModule } from './LayoutModule';

export type FleetLayout = {
  /**
   * Timestamp when the layout was generated.
   */
  updatedAt: string;
  modules: Array<LayoutModule>;
};

