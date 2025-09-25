<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import type { PageData } from './$types';
  import type { FleetDeviceAction, FleetDeviceDetail, FleetDeviceMetric } from '$lib/types';
  import { getFleetDeviceDetail, triggerDeviceAction } from '$lib/api/fleet-operations';

  export let data: PageData;

  let detail: FleetDeviceDetail | null = data.device ?? null;
  let loading = false;
  let actionLoading = new Set<string>();
  let error: string | null = null;

  const refresh = async () => {
    if (!detail) return;
    loading = true;
    try {
      detail = await getFleetDeviceDetail(detail.summary.id, { fetch });
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to refresh device';
    } finally {
      loading = false;
    }
  };

  const runAction = async (action: FleetDeviceAction) => {
    if (!detail || actionLoading.has(action.id)) return;
    actionLoading.add(action.id);
    try {
      detail = await triggerDeviceAction(detail.summary.id, action.id, { fetch });
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : `Unable to execute ${action.label}`;
    } finally {
      actionLoading.delete(action.id);
    }
  };

  const formatMetric = (metric: FleetDeviceMetric) =>
    metric.unit ? `${metric.value}${metric.unit}` : metric.value;

  const statusToPill = () => {
    if (!detail) return 'warn';
    if (detail.summary.status === 'online') return 'ok';
    if (detail.summary.status === 'error') return 'error';
    return 'warn';
  };
</script>

<svelte:head>
  <title>{detail ? `${detail.summary.name} – Fleet Device` : 'Fleet Device'}</title>
</svelte:head>

{#if !detail && error}
  <EmptyState title="Device unavailable" description={error}>
    <svelte:fragment slot="actions">
      <Button variant="primary" on:click={refresh}>Retry</Button>
    </svelte:fragment>
  </EmptyState>
{:else if !detail}
  <div class="loading">
    <Skeleton variant="block" height="16rem" />
    <Skeleton variant="block" height="12rem" />
  </div>
{:else}
  <div class="device">
    <div class="breadcrumb">
      <a href="/fleet">Fleet</a>
      <span>›</span>
      <span>{detail.summary.name}</span>
    </div>

    <div class="header">
      <div>
        <h1>{detail.summary.name}</h1>
        <p>{detail.summary.role} · {detail.summary.module}</p>
      </div>
      <div class="header-actions">
        <StatusPill status={statusToPill()} label={detail.summary.status} />
        <Button variant="ghost" on:click={refresh} disabled={loading}>Refresh</Button>
      </div>
    </div>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <div class="grid">
      <Card title="Summary" subtitle="Current device state">
        <dl class="summary">
          <div>
            <dt>Device ID</dt>
            <dd>{detail.summary.id}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{detail.summary.location ?? 'Unknown'}</dd>
          </div>
          <div>
            <dt>Groups</dt>
            <dd>{detail.summary.groups.join(', ') || '—'}</dd>
          </div>
          <div>
            <dt>Last seen</dt>
            <dd>{new Date(detail.summary.lastSeen).toLocaleString()}</dd>
          </div>
          <div>
            <dt>IP address</dt>
            <dd>{detail.summary.ipAddress}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{detail.summary.version}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Metrics" subtitle="Live telemetry">
        {#if !detail.metrics.length}
          <p class="muted">No telemetry available.</p>
        {:else}
          <ul class="metrics">
            {#each detail.metrics as metric (metric.id)}
              <li class={`status-${metric.status}`}>
                <span class="label">{metric.label}</span>
                <strong>{formatMetric(metric)}</strong>
                {#if metric.description}
                  <span class="hint">{metric.description}</span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </Card>

      <Card title="Alerts" subtitle="Outstanding issues">
        {#if !detail.alerts.length}
          <p class="muted">No active alerts.</p>
        {:else}
          <ul class="alerts">
            {#each detail.alerts as alert (alert.id)}
              <li class={`severity-${alert.severity}`}>
                <div>
                  <strong>{alert.message}</strong>
                  <span>{new Date(alert.createdAt).toLocaleString()}</span>
                </div>
                <span>{alert.acknowledged ? 'Acknowledged' : 'New'}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>

      <Card title="Recent logs" subtitle="Latest activity">
        {#if !detail.logs.length}
          <p class="muted">No device-level logs recorded.</p>
        {:else}
          <ul class="logs">
            {#each detail.logs.slice(0, 8) as log (log.id)}
              <li>
                <time datetime={log.timestamp}>{new Date(log.timestamp).toLocaleTimeString()}</time>
                <span class={`severity-${log.severity}`}>{log.severity}</span>
                <p>{log.message}</p>
              </li>
            {/each}
          </ul>
          <a class="link" href={`/logs?source=${detail.summary.id}`}>Open in logs console →</a>
        {/if}
      </Card>

      <Card title="Actions" subtitle="Control plane operations">
        {#if !detail.actions.length}
          <p class="muted">No actions available for this device.</p>
        {:else}
          <div class="actions">
            {#each detail.actions as action (action.id)}
              <Button
                variant={action.group === 'maintenance' ? 'secondary' : 'ghost'}
                class="action-button"
                on:click={() => runAction(action)}
                disabled={actionLoading.has(action.id)}
              >
                {actionLoading.has(action.id) ? 'Running…' : action.label}
              </Button>
            {/each}
          </div>
        {/if}
      </Card>

      <Card title="Connections" subtitle="Downstream dependencies">
        {#if !detail.connections.length}
          <p class="muted">No connection telemetry available.</p>
        {:else}
          <ul class="connections">
            {#each detail.connections as connection (connection.name)}
              <li class={`status-${connection.status}`}>
                <div>
                  <strong>{connection.name}</strong>
                  <span>{connection.status}</span>
                </div>
                <time datetime={connection.lastChecked}>Updated {new Date(connection.lastChecked).toLocaleTimeString()}</time>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>
    </div>
  </div>
{/if}

<style>
  .loading {
    display: grid;
    gap: var(--spacing-4);
  }

  .device {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .breadcrumb {
    display: flex;
    gap: var(--spacing-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .breadcrumb a {
    color: var(--color-brand);
    text-decoration: none;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
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

  .header-actions {
    display: flex;
    gap: var(--spacing-3);
    align-items: center;
  }

  .grid {
    display: grid;
    gap: var(--spacing-4);
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: var(--spacing-3);
  }

  dt {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  dd {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  .metrics,
  .alerts,
  .logs,
  .connections {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-3);
  }

  .metrics li,
  .alerts li,
  .logs li,
  .connections li {
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    background: rgba(15, 23, 42, 0.35);
  }

  .metrics li strong {
    font-size: var(--font-size-lg);
  }

  .metrics li .hint {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .metrics li.status-error {
    border-color: rgba(239, 68, 68, 0.4);
  }

  .metrics li.status-warn {
    border-color: rgba(245, 158, 11, 0.4);
  }

  .alerts li {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .alerts li span {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .logs li {
    display: grid;
    gap: 0.4rem;
  }

  .logs time {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .logs .severity-error {
    color: var(--color-red-300);
  }

  .logs .severity-warning {
    color: var(--color-yellow-300);
  }

  .link {
    display: inline-block;
    margin-top: var(--spacing-3);
    color: var(--color-brand);
    text-decoration: none;
  }

  .link:hover {
    text-decoration: underline;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-3);
  }

  .connections li {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .connections li.status-error {
    border-color: rgba(239, 68, 68, 0.35);
  }

  .connections li.status-pending {
    border-color: rgba(245, 158, 11, 0.35);
  }

  .error {
    color: var(--color-red-300);
  }

  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-3);
    }
  }
</style>
