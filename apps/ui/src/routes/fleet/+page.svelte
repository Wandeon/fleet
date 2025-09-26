<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import type { PageData } from './$types';
  import type { FleetDeviceSummary, FleetOverview } from '$lib/types';
  import { getFleetOverview } from '$lib/api/fleet-operations';
  import { goto } from '$app/navigation';

  export let data: PageData;

  let overview: FleetOverview | null = data.overview ?? null;
  let error: string | null = data.error ?? null;
  let loading = false;
  let filterModule = 'all';
  let filterStatus: 'all' | 'online' | 'offline' | 'error' | 'degraded' = 'all';

  const refresh = async () => {
    loading = true;
    try {
      overview = await getFleetOverview({ fetch });
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to refresh overview';
    } finally {
      loading = false;
    }
  };

  const filteredDevices = () => {
    if (!overview) return [] as FleetDeviceSummary[];
    return overview.devices.filter((device) => {
      const moduleMatch = filterModule === 'all' || device.module === filterModule;
      const statusMatch =
        filterStatus === 'all' ||
        (filterStatus === 'error' && device.status === 'error') ||
        (filterStatus === 'offline' && device.status === 'offline') ||
        (filterStatus === 'online' && device.status === 'online') ||
        (filterStatus === 'degraded' && device.status === 'error');
      return moduleMatch && statusMatch;
    });
  };

  const statusToPill = (status: FleetDeviceSummary['status']): 'ok' | 'warn' | 'error' => {
    if (status === 'online') return 'ok';
    if (status === 'error') return 'error';
    return 'warn';
  };
</script>

<svelte:head>
  <title>Fleet Overview</title>
</svelte:head>

<div class="fleet">
  <div class="header">
    <div>
      <h1>Fleet overview</h1>
      <p>Device health, module coverage, and quick navigation</p>
    </div>
    <Button variant="ghost" on:click={refresh} disabled={loading}>Refresh</Button>
  </div>

  {#if loading && !overview}
    <div class="loading">
      <Skeleton variant="block" height="8rem" />
      <Skeleton variant="block" height="12rem" />
    </div>
  {:else if error && !overview}
    <EmptyState title="Unable to load fleet" description={error}>
      <svelte:fragment slot="actions">
        <Button variant="primary" on:click={refresh}>Retry</Button>
      </svelte:fragment>
    </EmptyState>
  {:else if overview}
    <div class="summary-grid">
      <Card
        title="Totals"
        subtitle={`Last updated ${new Date(overview.updatedAt).toLocaleString()}`}
      >
        <div class="totals">
          <div>
            <span class="label">Devices</span>
            <strong>{overview.totals.devices}</strong>
          </div>
          <div>
            <span class="label">Online</span>
            <strong class="ok">{overview.totals.online}</strong>
          </div>
          <div>
            <span class="label">Offline</span>
            <strong class="error">{overview.totals.offline}</strong>
          </div>
          <div>
            <span class="label">Degraded</span>
            <strong class="warn">{overview.totals.degraded}</strong>
          </div>
        </div>
      </Card>

      <Card title="Modules" subtitle="Coverage by role">
        <ul class="modules">
          {#each overview.modules as module (module.label)}
            <li>
              <span class="name">{module.label}</span>
              <span class="counts">
                <span class="ok">{module.online} online</span>
                <span class="warn">{module.degraded} degraded</span>
                <span class="error">{module.offline} offline</span>
              </span>
              <button
                class:active={filterModule === module.id}
                on:click={() => (filterModule = filterModule === module.id ? 'all' : module.id)}
              >
                {filterModule === module.id ? 'Clear filter' : 'Filter'}
              </button>
            </li>
          {/each}
        </ul>
      </Card>
    </div>

    <Card title="Devices" subtitle="Select a device for detailed actions">
      <div class="device-toolbar">
        <label>
          <span>Status</span>
          <select bind:value={filterStatus}>
            <option value="all">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="error">Error</option>
            <option value="degraded">Degraded</option>
          </select>
        </label>
      </div>
      {#if !filteredDevices().length}
        <p class="muted">No devices match the selected filters.</p>
      {:else}
        <div class="device-grid">
          {#each filteredDevices() as device (device.id)}
            <button class="device-card" on:click={() => goto(`/fleet/${device.id}`)}>
              <div class="device-header">
                <h3>{device.name}</h3>
                <StatusPill status={statusToPill(device.status)} label={device.status} />
              </div>
              <dl>
                <div>
                  <dt>Module</dt>
                  <dd>{device.module}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{device.location ?? 'Unknown'}</dd>
                </div>
                <div>
                  <dt>Last seen</dt>
                  <dd>{new Date(device.lastSeen).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>{device.version}</dd>
                </div>
              </dl>
            </button>
          {/each}
        </div>
      {/if}
    </Card>
  {/if}
</div>

<style>
  .fleet {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
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

  .loading {
    display: grid;
    gap: var(--spacing-4);
  }

  .summary-grid {
    display: grid;
    gap: var(--spacing-6);
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  }

  .totals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: var(--spacing-4);
  }

  .totals .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
  }

  .totals strong {
    display: block;
    font-size: var(--font-size-xl);
  }

  .totals .ok {
    color: var(--color-emerald-300);
  }

  .totals .warn {
    color: var(--color-yellow-300);
  }

  .totals .error {
    color: var(--color-red-300);
  }

  .modules {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-3);
  }

  .modules li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(15, 23, 42, 0.35);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.15);
    gap: var(--spacing-3);
  }

  .modules .name {
    font-weight: 600;
  }

  .modules .counts {
    display: flex;
    gap: var(--spacing-3);
    font-size: var(--font-size-xs);
  }

  .modules button {
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: transparent;
    border-radius: var(--radius-md);
    padding: var(--spacing-2) var(--spacing-3);
    color: var(--color-text);
    cursor: pointer;
  }

  .modules button.active {
    border-color: var(--color-brand);
    background: rgba(59, 130, 246, 0.18);
  }

  .device-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: var(--spacing-3);
  }

  select {
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(11, 23, 45, 0.4);
    color: var(--color-text);
  }

  .device-grid {
    display: grid;
    gap: var(--spacing-4);
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  }

  .device-card {
    text-decoration: none;
    display: grid;
    gap: var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
    background: rgba(15, 23, 42, 0.35);
    color: inherit;
    transition:
      border-color 0.2s ease,
      transform 0.2s ease;
  }

  .device-card:hover {
    border-color: var(--color-brand);
    transform: translateY(-2px);
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .device-header h3 {
    margin: 0;
  }

  dl {
    margin: 0;
    display: grid;
    gap: var(--spacing-2);
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  dt {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  dd {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  .muted {
    color: var(--color-text-muted);
  }

  @media (max-width: 900px) {
    .summary-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
