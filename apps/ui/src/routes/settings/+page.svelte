<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { PageData } from './$types';
  import type { OperatorAccount, SettingsState } from '$lib/types';
  import {
    cancelPairing,
    getSettings,
    inviteOperator,
    rotateApiToken,
    startPairing,
    updateAllowedOrigins,
    updateProxySettings,
    claimDiscoveredDevice,
    removeOperator,
  } from '$lib/api/settings-operations';

  export let data: PageData;

  let settings: SettingsState | null = data.settings ?? null;
  let error: string | null = data.error ?? null;
  let loading = false;
  let rotatingToken = false;
  let savingProxy = false;
  let savingOrigins = false;
  let pairingInFlight = false;
  let inviting = false;
  let removing = new SvelteSet<string>();

  let proxyBaseUrl = settings?.proxy.baseUrl ?? '';
  let proxyTimeout = settings?.proxy.timeoutMs ?? 8000;
  let allowedOriginsText = settings?.api.allowedOrigins.join('\n') ?? '';
  let pairingDuration = 120;
  let pairingMethod: SettingsState['pairing']['method'] = settings?.pairing.method ?? 'manual';
  let newOperator: Pick<OperatorAccount, 'name' | 'email' | 'roles'> = {
    name: '',
    email: '',
    roles: ['viewer'],
  };

  let inviteError: string | null = null;

  const refreshSettings = async () => {
    loading = true;
    try {
      const latest = await getSettings({ fetch });
      settings = latest;
      proxyBaseUrl = latest.proxy.baseUrl;
      proxyTimeout = latest.proxy.timeoutMs;
      allowedOriginsText = latest.api.allowedOrigins.join('\n');
      pairingMethod = latest.pairing.method;
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load settings';
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    if (!settings && !error) {
      refreshSettings();
    }
  });

  onDestroy(() => {
    removing = new SvelteSet();
  });

  const handleRotateToken = async () => {
    if (!settings || rotatingToken) return;
    rotatingToken = true;
    try {
      settings = await rotateApiToken({ fetch });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to rotate token';
    } finally {
      rotatingToken = false;
    }
  };

  const handleProxySave = async () => {
    if (!settings || savingProxy) return;
    savingProxy = true;
    try {
      settings = await updateProxySettings(
        {
          baseUrl: proxyBaseUrl.trim(),
          timeoutMs: Number(proxyTimeout),
        },
        { fetch }
      );
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to update proxy settings';
    } finally {
      savingProxy = false;
    }
  };

  const handleOriginsSave = async () => {
    if (!settings || savingOrigins) return;
    savingOrigins = true;
    try {
      const origins = allowedOriginsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      settings = await updateAllowedOrigins(origins, { fetch });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to update allowed origins';
    } finally {
      savingOrigins = false;
    }
  };

  const handlePairingMethodChange = (event: Event) => {
    if (!settings) return;
    pairingMethod = (event.target as HTMLSelectElement).value as SettingsState['pairing']['method'];
    settings = { ...settings, pairing: { ...settings.pairing, method: pairingMethod } };
  };

  const handleStartPairing = async () => {
    if (pairingInFlight || !settings) return;
    pairingInFlight = true;
    try {
      settings = await startPairing(pairingMethod, pairingDuration, { fetch });
      pairingMethod = settings.pairing.method;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to start pairing';
    } finally {
      pairingInFlight = false;
    }
  };

  const handleCancelPairing = async () => {
    if (pairingInFlight || !settings) return;
    pairingInFlight = true;
    try {
      settings = await cancelPairing({ fetch });
      pairingMethod = settings.pairing.method;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to cancel pairing';
    } finally {
      pairingInFlight = false;
    }
  };

  const handleClaimDevice = async (candidateId: string) => {
    if (pairingInFlight || !settings) return;
    pairingInFlight = true;
    try {
      settings = await claimDiscoveredDevice(candidateId, { fetch });
      pairingMethod = settings.pairing.method;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to claim device';
    } finally {
      pairingInFlight = false;
    }
  };

  const handleInvite = async () => {
    if (!settings || inviting) return;
    inviteError = null;
    inviting = true;
    try {
      if (!newOperator.name.trim() || !newOperator.email.trim()) {
        throw new Error('Name and email are required');
      }
      settings = await inviteOperator(
        {
          name: newOperator.name.trim(),
          email: newOperator.email.trim(),
          roles: newOperator.roles,
        },
        { fetch }
      );
      newOperator = { name: '', email: '', roles: ['viewer'] };
    } catch (err) {
      inviteError = err instanceof Error ? err.message : 'Unable to send invitation';
    } finally {
      inviting = false;
    }
  };

  const addRemoving = (operatorId: string) => {
    const next = new SvelteSet(removing);
    next.add(operatorId);
    removing = next;
  };

  const deleteRemoving = (operatorId: string) => {
    if (!removing.has(operatorId)) return;
    const next = new SvelteSet(removing);
    next.delete(operatorId);
    removing = next;
  };

  const handleRemoveOperator = async (operatorId: string) => {
    if (removing.has(operatorId)) return;
    addRemoving(operatorId);
    try {
      settings = await removeOperator(operatorId, { fetch });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to remove operator';
    } finally {
      deleteRemoving(operatorId);
    }
  };

  const pairingCountdown = () => {
    if (!settings?.pairing.active || !settings.pairing.expiresAt) return null;
    const expires = new Date(settings.pairing.expiresAt).getTime();
    const remaining = Math.max(0, Math.floor((expires - Date.now()) / 1000));
    const minutes = Math.floor(remaining / 60);
    const seconds = String(remaining % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  };
</script>

<svelte:head>
  <title>Settings – Fleet Control</title>
</svelte:head>

<div class="settings-page">
  {#if loading && !settings}
    <div class="loading">
      <Skeleton variant="block" height="8rem" />
      <Skeleton variant="block" height="8rem" />
      <Skeleton variant="block" height="12rem" />
    </div>
  {:else if error && !settings}
    <EmptyState title="Unable to load settings" description={error}>
      <svelte:fragment slot="actions">
        <Button variant="primary" on:click={refreshSettings}>Retry</Button>
      </svelte:fragment>
    </EmptyState>
  {:else if settings}
    <div class="header">
      <div>
        <h1>Settings</h1>
        <p>Configure API access, device pairing, and operator roles</p>
      </div>
      <div class="header-actions">
        <Button variant="ghost" on:click={refreshSettings} disabled={loading}>Refresh</Button>
      </div>
    </div>

    <div class="grid">
      <Card
        title="Environment configuration"
        subtitle="Read-only settings from vps/fleet.env"
      >
        <div class="env-notice">
          <p>
            These settings are configured via environment variables in <code>vps/fleet.env</code> and
            cannot be modified through the UI.
          </p>
        </div>
        <div class="section">
          <dl>
            <div>
              <dt>API Base URL</dt>
              <dd>{data.envConfig.apiBaseUrl}</dd>
            </div>
            <div>
              <dt>API Bearer Token</dt>
              <dd>{data.envConfig.apiBearer}</dd>
            </div>
            <div>
              <dt>Host</dt>
              <dd>{data.envConfig.host}</dd>
            </div>
            <div>
              <dt>Port</dt>
              <dd>{data.envConfig.port}</dd>
            </div>
            <div>
              <dt>Origin</dt>
              <dd>{data.envConfig.origin}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card title="API access" subtitle="Token rotation and allowed origins">
        <div class="section">
          <dl>
            <div>
              <dt>Bearer token</dt>
              <dd>{settings.api.bearerTokenMasked ?? 'Not configured'}</dd>
            </div>
            <div>
              <dt>Last rotated</dt>
              <dd>
                {settings.api.lastRotatedAt
                  ? new Date(settings.api.lastRotatedAt).toLocaleString()
                  : 'Never'}
              </dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>
                {settings.api.expiresAt
                  ? new Date(settings.api.expiresAt).toLocaleString()
                  : 'Indefinite'}
              </dd>
            </div>
          </dl>
          <Button variant="secondary" on:click={handleRotateToken} disabled={rotatingToken}>
            {rotatingToken ? 'Rotating…' : 'Rotate token'}
          </Button>
        </div>

        <div class="section">
          <label>
            <span>Allowed origins</span>
            <textarea
              bind:value={allowedOriginsText}
              rows={4}
              placeholder="https://operations.example"
            ></textarea>
          </label>
          <div class="actions">
            <Button variant="primary" on:click={handleOriginsSave} disabled={savingOrigins}>
              {savingOrigins ? 'Saving…' : 'Save origins'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Proxy settings" subtitle="Edge proxy configuration">
        <div class="section">
          <label>
            <span>Base URL</span>
            <input type="url" bind:value={proxyBaseUrl} placeholder="https://proxy.internal" />
          </label>
          <label>
            <span>Timeout (ms)</span>
            <input type="number" bind:value={proxyTimeout} min={1000} step={500} />
          </label>
          <div class="proxy-stats">
            <div>
              <strong>Health</strong>
              <span class={settings.proxy.health}>{settings.proxy.health}</span>
            </div>
            <div>
              <strong>Latency</strong>
              <span>{settings.proxy.latencyMs} ms</span>
            </div>
            <div>
              <strong>Error rate</strong>
              <span>{(settings.proxy.errorRate * 100).toFixed(2)}%</span>
            </div>
          </div>
          <div class="actions">
            <Button variant="primary" on:click={handleProxySave} disabled={savingProxy}>
              {savingProxy ? 'Saving…' : 'Save proxy settings'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Device pairing" subtitle="Manage onboarding of new devices">
        <div class="pairing">
          <div class="status">
            <p class="state">
              Status: {settings.pairing.active
                ? `Active (${pairingCountdown() ?? 'pending'})`
                : 'Inactive'}
            </p>
            <p class="method">Method: {pairingMethod.toUpperCase()}</p>
          </div>
          <div class="controls">
            <select value={pairingMethod} on:change={handlePairingMethodChange}>
              <option value="manual">Manual</option>
              <option value="qr">QR</option>
              <option value="auto">Auto</option>
            </select>
            <input type="number" min={30} max={600} bind:value={pairingDuration} />
            {#if settings.pairing.active}
              <Button variant="ghost" on:click={handleCancelPairing} disabled={pairingInFlight}
                >Stop</Button
              >
            {:else}
              <Button variant="secondary" on:click={handleStartPairing} disabled={pairingInFlight}>
                {pairingInFlight ? 'Starting…' : 'Start pairing'}
              </Button>
            {/if}
          </div>
        </div>

        <div class="pairing-flex">
          <div class="panel">
            <h4>Discovered devices</h4>
            {#if !settings.pairing.discovered.length}
              <p class="muted">No devices discovered yet.</p>
            {:else}
              <ul>
                {#each settings.pairing.discovered as candidate (candidate.id)}
                  <li>
                    <div>
                      <strong>{candidate.name}</strong>
                      <span>{candidate.capability} · signal {candidate.signal}</span>
                    </div>
                    <Button
                      variant="secondary"
                      on:click={() => handleClaimDevice(candidate.id)}
                      disabled={pairingInFlight}
                    >
                      Approve
                    </Button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
          <div class="panel">
            <h4>Recent history</h4>
            {#if !settings.pairing.history.length}
              <p class="muted">No recent pairing events.</p>
            {:else}
              <ul>
                {#each settings.pairing.history.slice(0, 5) as entry (entry.id)}
                  <li>
                    <strong>{entry.deviceId}</strong>
                    <span
                      >{entry.status === 'success' ? 'Paired' : 'Failed'} · {new Date(
                        entry.completedAt
                      ).toLocaleString()}</span
                    >
                    {#if entry.note}
                      <em>{entry.note}</em>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      </Card>

      <Card title="Operators" subtitle="Manage access for your team">
        <div class="operators">
          <form class="invite" on:submit|preventDefault={handleInvite}>
            <div class="fields">
              <label>
                <span>Name</span>
                <input type="text" bind:value={newOperator.name} placeholder="Jane Doe" />
              </label>
              <label>
                <span>Email</span>
                <input type="email" bind:value={newOperator.email} placeholder="jane@example.com" />
              </label>
              <label>
                <span>Role</span>
                <select value={newOperator.roles[0]} on:change={(event) => (newOperator = { ...newOperator, roles: [(event.target as HTMLSelectElement).value] })}>
                  {#each settings.roles as role (role.id)}
                    <option value={role.id}>{role.name}</option>
                  {/each}
                </select>
              </label>
            </div>
            <div class="actions">
              <Button variant="primary" type="submit" disabled={inviting}>
                {inviting ? 'Inviting…' : 'Send invite'}
              </Button>
            </div>
            {#if inviteError}
              <p class="error" role="alert">{inviteError}</p>
            {/if}
          </form>

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Last active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each settings.operators as operator (operator.id)}
                <tr>
                  <td>{operator.name}</td>
                  <td>{operator.email}</td>
                  <td>{operator.roles.join(', ')}</td>
                  <td>{operator.status}</td>
                  <td
                    >{operator.lastActiveAt
                      ? new Date(operator.lastActiveAt).toLocaleString()
                      : '—'}</td
                  >
                  <td>
                    <Button
                      variant="ghost"
                      on:click={() => handleRemoveOperator(operator.id)}
                      disabled={removing.has(operator.id)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  {/if}
</div>

<style>
  .settings-page {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
  }

  .loading {
    display: grid;
    gap: var(--spacing-4);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h1 {
    margin: 0;
  }

  .header p {
    margin: 0;
    color: var(--color-text-muted);
  }

  .grid {
    display: grid;
    gap: var(--spacing-6);
  }

  .section {
    display: grid;
    gap: var(--spacing-3);
  }

  dl {
    display: grid;
    gap: var(--spacing-2);
    margin: 0;
  }

  dt {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  dd {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  textarea,
  input,
  select {
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(11, 23, 45, 0.4);
    color: var(--color-text);
  }

  textarea {
    resize: vertical;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .proxy-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: var(--spacing-3);
  }

  .proxy-stats span.ok {
    color: var(--color-emerald-300);
  }

  .proxy-stats span.degraded {
    color: var(--color-yellow-300);
  }

  .proxy-stats span.offline {
    color: var(--color-red-300);
  }

  .pairing {
    display: grid;
    gap: var(--spacing-3);
  }

  .pairing .controls {
    display: flex;
    gap: var(--spacing-3);
    flex-wrap: wrap;
    align-items: center;
  }

  .pairing-flex {
    display: grid;
    gap: var(--spacing-4);
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  }

  .panel {
    display: grid;
    gap: var(--spacing-3);
    background: rgba(11, 23, 45, 0.3);
    border-radius: var(--radius-md);
    padding: var(--spacing-4);
    border: 1px solid rgba(148, 163, 184, 0.15);
  }

  .panel ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-3);
  }

  .panel li {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-3);
    align-items: center;
  }

  .muted {
    margin: 0;
    color: var(--color-text-muted);
  }

  .operators {
    display: grid;
    gap: var(--spacing-4);
  }

  .invite {
    display: grid;
    gap: var(--spacing-3);
    background: rgba(15, 23, 42, 0.35);
    border-radius: var(--radius-md);
    padding: var(--spacing-4);
    border: 1px solid rgba(148, 163, 184, 0.15);
  }

  .invite .fields {
    display: grid;
    gap: var(--spacing-3);
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: var(--spacing-2) var(--spacing-3);
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    text-align: left;
    font-size: var(--font-size-sm);
  }

  th {
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .error {
    margin: 0;
    color: var(--color-red-300);
    font-size: var(--font-size-sm);
  }

  .env-notice {
    background: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.2);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    margin-bottom: var(--spacing-3);
  }

  .env-notice p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }

  .env-notice code {
    background: rgba(15, 23, 42, 0.6);
    padding: 0.15rem 0.4rem;
    border-radius: var(--radius-sm);
    font-family: monospace;
    font-size: var(--font-size-sm);
    color: var(--color-brand);
  }

  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      gap: var(--spacing-3);
      align-items: flex-start;
    }
  }
</style>
