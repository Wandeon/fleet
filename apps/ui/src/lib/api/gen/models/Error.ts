/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type Error = {
  /**
   * Machine-readable error code.
   */
  code: string;
  /**
   * Human-readable summary of the error.
   */
  message: string;
  /**
   * Optional client-facing recommendation.
   */
  hint?: string | null;
  /**
   * Correlates the request across systems.
   */
  correlationId: string;
  /**
   * Additional contextual information for debugging.
   */
  details?: any;
};

