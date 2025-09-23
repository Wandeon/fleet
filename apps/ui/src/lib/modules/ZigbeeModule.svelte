<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import type { StatusLevel } from '$lib/components/types';
  import type { PanelState } from '$lib/stores/app';
  import type { ZigbeeState } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  export let data: ZigbeeState | null = null;
  export let state: PanelState = 'success';
  export let onRetry: (() => void) | undefined;
  export let title = 'Zigbee';

  const dispatch = createEventDispatcher();

  function retry() {
    dispatch('retry');
    onRetry?.();
  }

  const formatStateLabel = (state: ZigbeeState['devices'][number]['state']) =>
    state.replace(/(^|\s)\S/g, (segment) => segment.toUpperCase());

  const toStatus = (state: ZigbeeState['devices'][number]['state']): StatusLevel => {
    if (state === 'active' || state === 'closed') return 'ok';
    if (state === 'open') return 'warn';
    return 'offline';
  };
</script>

<Card title={title} subtitle="Mesh network status">
  {#if state === 'loading'}
    <div class="stack">
      <Skeleton variant="line" />
      <Skeleton variant="block" height="10rem" />
    </div>
  {:else if state === 'error'}
    <div class="error-state" role="alert">
      <p>Zigbee controller unreachable. Try again?</p>
      <Button variant="primary" on:click={retry}>Retry</Button>
    </div>
  {:else if state === 'empty'}
    <EmptyState title="No Zigbee devices" description="Pair a sensor or dimmer to populate the table.">
      <svelte:fragment slot="icon">🕸️</svelte:fragment>
    </EmptyState>
  {:else if data}
    <div class="zigbee-grid">
      <div class="actions">
        {#each data.quickActions as action (action.id)}
          <Button variant="secondary">{action.label}</Button>
        {/each}
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">State</th>
              <th scope="col">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {#each data.devices as device (device.id)}
              <tr>
                <th scope="row">{device.name}</th>
                <td>{device.type}</td>
                <td>
                  <StatusPill status={toStatus(device.state)} label={formatStateLabel(device.state)} />
                </td>
                <td>{new Date(device.lastSeen).toLocaleTimeString()}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {:else}
    <EmptyState title="Zigbee data missing" description="Unable to read Zigbee telemetry." />
  {/if}
</Card>

<style>
  .stack {
    display: grid;
    gap: var(--spacing-3);
  }

  .error-state {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .zigbee-grid {
    display: grid;
    gap: var(--spacing-3);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .table-wrapper {
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: var(--radius-md);
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 32rem;
  }

  th,
  td {
    padding: 0.75rem;
    text-align: left;
  }

  thead {
    background: rgba(15, 23, 42, 0.6);
  }

  tbody tr:nth-child(even) {
    background: rgba(148, 163, 184, 0.05);
  }

  tbody tr:hover {
    background: rgba(56, 189, 248, 0.12);
  }
</style>
