/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FleetLayout } from '../models/FleetLayout';
import type { FleetState } from '../models/FleetState';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class FleetService {

  /**
   * Retrieve layout metadata for Fleet UI modules.
   * Returns the list of modules the UI should render and their exposed capabilities.
   * @returns FleetLayout Layout information for all modules.
   * @throws ApiError
   */
  public static getFleetLayout(): CancelablePromise<FleetLayout> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/fleet/layout',
      errors: {
        401: `Authentication credentials missing or invalid.`,
        403: `Authenticated user lacks required scope.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Retrieve summarized state for the dashboard view.
   * Aggregates the latest audio, video, Zigbee, and camera status into a single payload for the dashboard.
   * @returns FleetState Summarized fleet state.
   * @throws ApiError
   */
  public static getFleetState(): CancelablePromise<FleetState> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/fleet/state',
      errors: {
        401: `Authentication credentials missing or invalid.`,
        403: `Authenticated user lacks required scope.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

}
