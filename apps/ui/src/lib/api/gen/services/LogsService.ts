/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LogEntry } from '../models/LogEntry';
import type { LogsExportRequest } from '../models/LogsExportRequest';
import type { LogsExportResponse } from '../models/LogsExportResponse';
import type { LogsSnapshot } from '../models/LogsSnapshot';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class LogsService {

  /**
   * Retrieve a snapshot of recent logs with optional filtering.
   * Retrieve a snapshot of recent logs with optional filtering.
   * @param source Limit log entries to a specific source identifier.
   * @param level Filter log entries to a specific severity level.
   * @param q Free-text search filter applied to message and context fields.
   * @param limit Maximum number of results to return.
   * @param cursor Opaque pagination cursor returned by previous responses.
   * @returns LogsSnapshot Logs snapshot response.
   * @throws ApiError
   */
  public static getLogs(
    source?: string,
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    q?: string,
    limit: number = 50,
    cursor?: string,
  ): CancelablePromise<LogsSnapshot> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/logs',
      query: {
        'source': source,
        'level': level,
        'q': q,
        'limit': limit,
        'cursor': cursor,
      },
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Subscribe to the live event stream of log entries.
   * Subscribe to the live event stream of log entries.
   * @param source Limit log entries to a specific source identifier.
   * @param level Filter log entries to a specific severity level.
   * @param q Free-text search filter applied to message and context fields.
   * @param accept
   * @returns string Server-sent events stream of log entries.
   * @throws ApiError
   */
  public static streamLogs(
    source?: string,
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    q?: string,
    accept?: string,
  ): CancelablePromise<string> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/logs/stream',
      headers: {
        'accept': accept,
      },
      query: {
        'source': source,
        'level': level,
        'q': q,
      },
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Retrieve a filtered slice of logs for operator review.
   * Fetch recent log lines matching severity, device, and correlation filters for troubleshooting.
   * @param level Filter log entries to a specific severity level.
   * @param deviceId Filter to a specific device identifier.
   * @param correlationId Filter by correlation identifier.
   * @param limit
   * @returns any Filtered log entries.
   * @throws ApiError
   */
  public static queryLogs(
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    deviceId?: string,
    correlationId?: string,
    limit: number = 100,
  ): CancelablePromise<{
    items: Array<LogEntry>;
    total: number;
    fetchedAt: string;
  }> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/logs/query',
      query: {
        'level': level,
        'deviceId': deviceId,
        'correlationId': correlationId,
        'limit': limit,
      },
      errors: {
        400: `One or more request parameters failed validation.`,
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Create an export of logs matching a filter set.
   * Queue a downloadable log export job using optional filters for offline analysis.
   * @param requestBody
   * @returns LogsExportResponse Export scheduled.
   * @throws ApiError
   */
  public static exportLogs(
    requestBody?: LogsExportRequest,
  ): CancelablePromise<LogsExportResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/logs/export',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `One or more request parameters failed validation.`,
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

}
