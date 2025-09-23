/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HealthSummary } from '../models/HealthSummary';
import type { RecentEvents } from '../models/RecentEvents';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class HealthService {

  /**
   * Fleet-wide health summary for observability panel.
   * Collates module health states, marking degraded components and timestamping the snapshot.
   * @returns HealthSummary Health information for modules.
   * @throws ApiError
   */
  public static getHealthSummary(): CancelablePromise<HealthSummary> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/health/summary',
      errors: {
        401: `Authentication credentials missing or invalid.`,
        403: `Authenticated user lacks required scope.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Retrieve recent cross-module events for the activity feed.
   * Returns a flattened, paginated activity feed across all Fleet subsystems.
   * @param limit Maximum number of events to return.
   * @param cursor Opaque pagination cursor returned by previous responses.
   * @returns RecentEvents Recent fleet events.
   * @throws ApiError
   */
  public static getRecentEvents(
    limit: number = 50,
    cursor?: string,
  ): CancelablePromise<RecentEvents> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/events/recent',
      query: {
        'limit': limit,
        'cursor': cursor,
      },
      errors: {
        401: `Authentication credentials missing or invalid.`,
        403: `Authenticated user lacks required scope.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

}
