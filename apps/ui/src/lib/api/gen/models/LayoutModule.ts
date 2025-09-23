/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type LayoutModule = {
  /**
   * Stable module identifier.
   */
  id: string;
  displayName: string;
  /**
   * Whether the module is currently enabled in the UI.
   */
  enabled: boolean;
  description?: string | null;
  capabilities: Array<string>;
};

