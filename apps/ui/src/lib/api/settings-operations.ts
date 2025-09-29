// import { browser } from '$app/environment';
import { rawRequest, USE_MOCKS, UiApiError } from '$lib/api/client';
import type { RequestOptions } from '$lib/api/client';
import { mockApi } from '$lib/api/mock';
import type { OperatorAccount, PairingStatus, ProxySettings, SettingsState, PairingDiscoveryCandidate } from '$lib/types';

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;
const jsonHeaders = { 'Content-Type': 'application/json' } as const;

export interface SettingsFetchOptions {
  fetch?: typeof fetch;
}

export const getSettings = async (options: SettingsFetchOptions = {}): Promise<SettingsState> => {
  if (USE_MOCKS) {
    return mockApi.settings();
  }

  const fetchImpl = ensureFetch(options.fetch);
  const rawResponse = await rawRequest<Record<string, unknown>>('/settings', {
    method: 'GET',
    fetch: fetchImpl as RequestOptions['fetch'],
  });

  // Transform API response to match UI expectations
  return transformSettingsResponse(rawResponse);
};

function transformSettingsResponse(raw: Record<string, unknown>): SettingsState {
  return {
    api: {
      bearerTokenMasked: (raw.apiTokenPreview as string) || null,
      lastRotatedAt: null, // API doesn't provide this yet
      expiresAt: null, // API doesn't provide this yet
      allowedOrigins: (raw.allowedOrigins as string[]) || [],
      webhookUrl: null, // API doesn't provide this yet
    },
    proxy: {
      baseUrl: ((raw.proxy as Record<string, unknown>)?.upstreamUrl as string) || '',
      timeoutMs: 8000, // Default since API doesn't provide this
      health: 'online', // Default since API doesn't provide this
      latencyMs: 0, // Default since API doesn't provide this
      errorRate: 0, // Default since API doesn't provide this
    },
    pairing: {
      active: ((raw.pairing as Record<string, unknown>)?.active as boolean) || false,
      method: 'manual', // Default since API doesn't provide this
      expiresAt: ((raw.pairing as Record<string, unknown>)?.expiresAt as string) || null,
      discovered: ((raw.pairing as Record<string, unknown>)?.candidates as PairingDiscoveryCandidate[]) || [],
      history: [], // API doesn't provide this yet
    },
    operators: (raw.operators as OperatorAccount[]) || [],
    roles: [
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full access to all settings and controls',
        permissions: ['read', 'write', 'admin'],
        assignable: true
      },
      {
        id: 'operator',
        name: 'Operator',
        description: 'Can operate devices and view settings',
        permissions: ['read', 'write'],
        assignable: true
      },
      {
        id: 'viewer',
        name: 'Viewer',
        description: 'Read-only access to monitoring and logs',
        permissions: ['read'],
        assignable: true
      },
    ], // Default roles since API doesn't provide this
    pendingRestart: false, // Default since API doesn't provide this
    lastSavedAt: (raw.updatedAt as string) || null,
  };
}

export const updateProxySettings = async (
  proxy: Partial<ProxySettings>,
  options: SettingsFetchOptions = {}
): Promise<SettingsState> => {
  if (USE_MOCKS) {
    return mockApi.settingsUpdate({ proxy: { ...mockApi.settings().proxy, ...proxy } });
  }

  const fetchImpl = ensureFetch(options.fetch);
  const payload = { proxy } satisfies { proxy: Partial<ProxySettings> };
  await rawRequest('/settings/proxy', {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
    fetch: fetchImpl as RequestOptions['fetch'],
  });
  return getSettings(options);
};

export const rotateApiToken = async (
  options: SettingsFetchOptions = {}
): Promise<SettingsState> => {
  if (USE_MOCKS) {
    return mockApi.settingsRotateToken();
  }

  const fetchImpl = ensureFetch(options.fetch);
  await rawRequest('/settings/api-token', {
    method: 'POST',
    fetch: fetchImpl as RequestOptions['fetch'],
  });
  return getSettings(options);
};

export const updateAllowedOrigins = async (
  origins: string[],
  options: SettingsFetchOptions = {}
): Promise<SettingsState> => {
  if (USE_MOCKS) {
    const deduped = Array.from(new Set(origins.map((entry) => entry.trim()).filter(Boolean)));
    return mockApi.settingsUpdate({ api: { ...mockApi.settings().api, allowedOrigins: deduped } });
  }

  const fetchImpl = ensureFetch(options.fetch);
  await rawRequest('/settings/allowed-origins', {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ origins }),
    fetch: fetchImpl as RequestOptions['fetch'],
  });
  return getSettings(options);
};

export const startPairing = async (
  method: PairingStatus['method'],
  durationSeconds: number,
  options: SettingsFetchOptions = {}
): Promise<SettingsState> => {
  if (USE_MOCKS) {
    return mockApi.settingsStartPairing(method, durationSeconds);
  }

  const fetchImpl = ensureFetch(options.fetch);
  await rawRequest('/settings/pairing/start', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ method, durationSeconds }),
    fetch: fetchImpl as RequestOptions['fetch'],
  });
  return getSettings(options);
};

export const cancelPairing = async (options: SettingsFetchOptions = {}): Promise<SettingsState> => {
  if (USE_MOCKS) {
    return mockApi.settingsCancelPairing();
  }

  const fetchImpl = ensureFetch(options.fetch);
  await rawRequest('/settings/pairing/cancel', {
    method: 'POST',
    fetch: fetchImpl as RequestOptions['fetch'],
  });
  return getSettings(options);
};

export const claimDiscoveredDevice = async (
  candidateId: string,
  options: SettingsFetchOptions & {
    note?: string;
    status?: 'success' | 'error';
    deviceId?: string;
  } = {}
): Promise<SettingsState> => {
  if (USE_MOCKS) {
    return mockApi.settingsClaimDiscovered(candidateId, {
      note: options.note,
      status: options.status,
      deviceId: options.deviceId,
    });
  }

  const fetchImpl = ensureFetch(options.fetch);
  await rawRequest(`/settings/pairing/${encodeURIComponent(candidateId)}/claim`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      note: options.note,
      status: options.status,
      deviceId: options.deviceId,
    }),
    fetch: fetchImpl as RequestOptions['fetch'],
  });
  return getSettings(options);
};

export const inviteOperator = async (
  operator: Pick<OperatorAccount, 'name' | 'email' | 'roles'>,
  options: SettingsFetchOptions = {}
): Promise<SettingsState> => {
  if (USE_MOCKS) {
    const current = mockApi.settings();
    const entry: OperatorAccount = {
      id: `op-${Math.random().toString(16).slice(2, 8)}`,
      name: operator.name,
      email: operator.email,
      roles: operator.roles,
      status: 'invited',
      lastActiveAt: null,
    };
    return mockApi.settingsUpdate({ operators: [...current.operators, entry] });
  }

  const fetchImpl = ensureFetch(options.fetch);
  await rawRequest('/settings/operators', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(operator),
    fetch: fetchImpl as RequestOptions['fetch'],
  });
  return getSettings(options);
};

export const removeOperator = async (
  operatorId: string,
  options: SettingsFetchOptions = {}
): Promise<SettingsState> => {
  if (USE_MOCKS) {
    const current = mockApi.settings();
    const filtered = current.operators.filter(
      (operator: OperatorAccount) => operator.id !== operatorId
    );
    return mockApi.settingsUpdate({
      operators: filtered,
    });
  }

  const fetchImpl = ensureFetch(options.fetch);
  await rawRequest(`/settings/operators/${encodeURIComponent(operatorId)}`, {
    method: 'DELETE',
    fetch: fetchImpl as RequestOptions['fetch'],
  });
  return getSettings(options);
};

export const saveSettingsDraft = async (
  draft: Partial<SettingsState>
): Promise<SettingsState> => {
  if (USE_MOCKS) {
    return mockApi.settingsUpdate(draft);
  }

  throw new UiApiError('Full settings write not yet supported via UI', 501);
};
