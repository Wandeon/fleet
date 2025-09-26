/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ZigbeeActionRequest } from '../models/ZigbeeActionRequest';
import type { ZigbeePairingStartRequest } from '../models/ZigbeePairingStartRequest';
import type { ZigbeePairingState } from '../models/ZigbeePairingState';
import type { ZigbeeRule } from '../models/ZigbeeRule';
import type { ZigbeeRuleDefinition } from '../models/ZigbeeRuleDefinition';
import type { ZigbeeRuleListResponse } from '../models/ZigbeeRuleListResponse';
import type { ZigbeeRuleSimulationRequest } from '../models/ZigbeeRuleSimulationRequest';
import type { ZigbeeRuleSimulationResponse } from '../models/ZigbeeRuleSimulationResponse';
import type { ZigbeeRuleUpdateRequest } from '../models/ZigbeeRuleUpdateRequest';
import type { ZigbeeRuleValidationResponse } from '../models/ZigbeeRuleValidationResponse';
import type { ZigbeeState } from '../models/ZigbeeState';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class ZigbeeService {
  /**
   * List Zigbee automation rules.
   * Retrieve all configured Zigbee automation rules with trigger and action metadata.
   * @returns ZigbeeRuleListResponse Collection of automation rules.
   * @throws ApiError
   */
  public static listZigbeeRules(): CancelablePromise<ZigbeeRuleListResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/zigbee/rules',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Create a new Zigbee automation rule.
   * Persist a Zigbee automation rule that links triggers to downstream actions.
   * @param requestBody
   * @returns ZigbeeRule Automation rule created.
   * @throws ApiError
   */
  public static createZigbeeRule(requestBody: ZigbeeRuleDefinition): CancelablePromise<ZigbeeRule> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/zigbee/rules',
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

  /**
   * Validate a Zigbee automation rule definition.
   * Validate a Zigbee automation rule definition without persisting it.
   * @param requestBody
   * @returns ZigbeeRuleValidationResponse Validation outcome.
   * @throws ApiError
   */
  public static validateZigbeeRule(
    requestBody: ZigbeeRuleDefinition
  ): CancelablePromise<ZigbeeRuleValidationResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/zigbee/rules/validate',
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

  /**
   * Simulate execution of a Zigbee automation rule.
   * Evaluate a Zigbee automation rule against sample trigger input within a sandbox.
   * @param requestBody
   * @returns ZigbeeRuleSimulationResponse Simulation evaluation outcome.
   * @throws ApiError
   */
  public static simulateZigbeeRule(
    requestBody: ZigbeeRuleSimulationRequest
  ): CancelablePromise<ZigbeeRuleSimulationResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/zigbee/rules/simulate',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `One or more request parameters failed validation.`,
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        404: `Requested resource does not exist.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Retrieve a Zigbee automation rule.
   * Fetch metadata for a specific Zigbee automation rule by identifier.
   * @param ruleId
   * @returns ZigbeeRule Automation rule detail.
   * @throws ApiError
   */
  public static getZigbeeRule(ruleId: string): CancelablePromise<ZigbeeRule> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/zigbee/rules/{ruleId}',
      path: {
        ruleId: ruleId,
      },
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        404: `Requested resource does not exist.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Update a Zigbee automation rule.
   * Replace fields on an existing Zigbee automation rule.
   * @param ruleId
   * @param requestBody
   * @returns ZigbeeRule Updated automation rule.
   * @throws ApiError
   */
  public static updateZigbeeRule(
    ruleId: string,
    requestBody: ZigbeeRuleUpdateRequest
  ): CancelablePromise<ZigbeeRule> {
    return __request(OpenAPI, {
      method: 'PUT',
      url: '/zigbee/rules/{ruleId}',
      path: {
        ruleId: ruleId,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `One or more request parameters failed validation.`,
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        404: `Requested resource does not exist.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Delete a Zigbee automation rule.
   * Remove a Zigbee automation rule and disable associated automations.
   * @param ruleId
   * @returns void
   * @throws ApiError
   */
  public static deleteZigbeeRule(ruleId: string): CancelablePromise<void> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/zigbee/rules/{ruleId}',
      path: {
        ruleId: ruleId,
      },
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        404: `Requested resource does not exist.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Toggle a Zigbee automation rule.
   * Enable or disable a Zigbee automation rule without modifying other metadata.
   * @param ruleId
   * @param requestBody
   * @returns ZigbeeRule Updated automation rule status.
   * @throws ApiError
   */
  public static toggleZigbeeRule(
    ruleId: string,
    requestBody?: {
      enabled?: boolean;
    }
  ): CancelablePromise<ZigbeeRule> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/zigbee/rules/{ruleId}/enable',
      path: {
        ruleId: ruleId,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        404: `Requested resource does not exist.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Retrieve Zigbee hub state, devices, and quick actions.
   * Retrieve Zigbee hub state, devices, and quick actions.
   * @returns ZigbeeState Zigbee overview payload.
   * @throws ApiError
   */
  public static getZigbeeOverview(): CancelablePromise<ZigbeeState> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/zigbee/overview',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
        502: `Upstream device returned an invalid response or is unreachable.`,
        504: `Upstream device timed out while processing the request.`,
      },
    });
  }

  /**
   * Execute a quick action on a Zigbee device.
   * Execute a quick action on a Zigbee device.
   * @param deviceId
   * @param requestBody
   * @returns any Action accepted.
   * @throws ApiError
   */
  public static runZigbeeAction(
    deviceId: string,
    requestBody: ZigbeeActionRequest
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/zigbee/devices/{deviceId}/action',
      path: {
        deviceId: deviceId,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `One or more request parameters failed validation.`,
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        404: `Requested resource does not exist.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
      },
    });
  }

  /**
   * Start Zigbee pairing mode for discovering new devices.
   * Start Zigbee pairing mode for discovering new devices.
   * @param requestBody
   * @returns ZigbeePairingState Pairing window started.
   * @throws ApiError
   */
  public static startZigbeePairing(
    requestBody?: ZigbeePairingStartRequest
  ): CancelablePromise<ZigbeePairingState> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/zigbee/pairing',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `One or more request parameters failed validation.`,
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
      },
    });
  }

  /**
   * Stop Zigbee pairing mode.
   * Stop Zigbee pairing mode.
   * @returns ZigbeePairingState Pairing mode stopped.
   * @throws ApiError
   */
  public static stopZigbeePairing(): CancelablePromise<ZigbeePairingState> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/zigbee/pairing',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
      },
    });
  }

  /**
   * Poll for newly discovered Zigbee devices during pairing mode.
   * Poll for newly discovered Zigbee devices during pairing mode.
   * @returns ZigbeePairingState Discovered devices snapshot.
   * @throws ApiError
   */
  public static pollZigbeeDiscovered(): CancelablePromise<ZigbeePairingState> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/zigbee/pairing/discovered',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
      },
    });
  }

  /**
   * Confirm pairing of a discovered Zigbee device.
   * Confirm pairing of a discovered Zigbee device.
   * @param deviceId
   * @returns any Pairing confirmation accepted.
   * @throws ApiError
   */
  public static confirmZigbeePairing(deviceId: string): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/zigbee/pairing/{deviceId}',
      path: {
        deviceId: deviceId,
      },
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        404: `Requested resource does not exist.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
        501: `Endpoint contract defined but backend implementation is pending.`,
      },
    });
  }
}
