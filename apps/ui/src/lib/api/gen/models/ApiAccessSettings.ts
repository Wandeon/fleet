/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ApiAccessSettings = {
  bearerTokenMasked: string | null;
  lastRotatedAt: string | null;
  expiresAt?: string | null;
  allowedOrigins: Array<string>;
  webhookUrl?: string | null;
};

