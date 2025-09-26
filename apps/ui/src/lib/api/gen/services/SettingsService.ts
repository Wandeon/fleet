/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AllowedOriginsRequest } from '../models/AllowedOriginsRequest';
import type { InviteOperatorRequest } from '../models/InviteOperatorRequest';
import type { OperatorAccount } from '../models/OperatorAccount';
import type { PairingClaimRequest } from '../models/PairingClaimRequest';
import type { PairingStartRequest } from '../models/PairingStartRequest';
import type { ProxySettings } from '../models/ProxySettings';
import type { ProxyUpdateRequest } from '../models/ProxyUpdateRequest';
import type { SettingsPairingState } from '../models/SettingsPairingState';
import type { SettingsState } from '../models/SettingsState';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class SettingsService {

  /**
   * Retrieve operator settings, proxy configuration, and pairing status.
   * Retrieve operator settings, proxy configuration, and pairing status.
   * @returns SettingsState Settings payload for the control plane.
   * @throws ApiError
   */
  public static getSettings(): CancelablePromise<SettingsState> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/settings',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Update proxy configuration settings.
   * Update proxy configuration settings.
   * @param requestBody
   * @returns any Proxy update accepted.
   * @throws ApiError
   */
  public static updateProxySettings(
    requestBody: ProxyUpdateRequest,
  ): CancelablePromise<{
    proxy: ProxySettings;
    updatedAt: string;
  }> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/settings/proxy',
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
   * Rotate the API bearer token used by operator integrations.
   * Rotate the API bearer token used by operator integrations.
   * @returns any Token rotation accepted.
   * @throws ApiError
   */
  public static rotateApiToken(): CancelablePromise<{
    status: string;
    tokenPreview: string;
    rotatedAt: string;
  }> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/settings/api-token',
      errors: {
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Replace the list of allowed CORS origins for the API.
   * Replace the list of allowed CORS origins for the API.
   * @param requestBody
   * @returns any Allowed origins updated.
   * @throws ApiError
   */
  public static updateAllowedOrigins(
    requestBody: AllowedOriginsRequest,
  ): CancelablePromise<{
    allowedOrigins: Array<string>;
    updatedAt: string;
  }> {
    return __request(OpenAPI, {
      method: 'PUT',
      url: '/settings/allowed-origins',
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
   * Start operator pairing flow for onboarding new devices.
   * Start operator pairing flow for onboarding new devices.
   * @param requestBody
   * @returns SettingsPairingState Pairing flow started.
   * @throws ApiError
   */
  public static startSettingsPairing(
    requestBody: PairingStartRequest,
  ): CancelablePromise<SettingsPairingState> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/settings/pairing/start',
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
   * Cancel an in-progress pairing flow.
   * Cancel an in-progress pairing flow.
   * @returns any Pairing flow cancelled.
   * @throws ApiError
   */
  public static cancelSettingsPairing(): CancelablePromise<{
    cancelled: boolean;
    updatedAt: string;
  }> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/settings/pairing/cancel',
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
   * Claim a discovered device and record pairing outcome.
   * Claim a discovered device and record pairing outcome.
   * @param candidateId
   * @param requestBody
   * @returns any Pairing candidate claim accepted.
   * @throws ApiError
   */
  public static claimPairingCandidate(
    candidateId: string,
    requestBody?: PairingClaimRequest,
  ): CancelablePromise<{
    accepted: boolean;
    candidateId: string;
    metadata: Record<string, string>;
    updatedAt: string;
  }> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/settings/pairing/{candidateId}/claim',
      path: {
        'candidateId': candidateId,
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
   * Invite a new operator account with specified roles.
   * Invite a new operator account with specified roles.
   * @param requestBody
   * @returns OperatorAccount Operator invited.
   * @throws ApiError
   */
  public static inviteOperator(
    requestBody: InviteOperatorRequest,
  ): CancelablePromise<OperatorAccount> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/settings/operators',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `One or more request parameters failed validation.`,
        401: `Authentication failed or credentials missing.`,
        403: `Authenticated user does not have permission to access the resource.`,
        409: `Operator already exists.`,
        429: `Request rate limit exceeded.`,
        500: `Unexpected server error occurred.`,
      },
    });
  }

  /**
   * Remove an operator account.
   * Remove an operator account.
   * @param operatorId
   * @returns any Operator removal accepted.
   * @throws ApiError
   */
  public static removeOperator(
    operatorId: string,
  ): CancelablePromise<{
    removed: boolean;
    operatorId: string;
    updatedAt: string;
  }> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/settings/operators/{operatorId}',
      path: {
        'operatorId': operatorId,
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

}
