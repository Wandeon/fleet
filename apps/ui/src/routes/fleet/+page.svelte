<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { resolve } from '$app/paths';
  import type { PageData } from './$types';

  export let data: PageData;

  const statusCopy: Record<'online' | 'offline' | 'error', string> = {
    online: 'Online',
    offline: 'Offline',
    error: 'Error'
  };

  const statusClass: Record<'online' | 'offline' | 'error', string> = {
    online: 'online',
    offline: 'offline',
    error: 'error'
  };
</script>

<svelte:head>
  <title>Fleet Overview</title>
</svelte:head>

<div class="fleet-page">
  <header class="page-header">
    <div>
      <h1>Fleet</h1>
      <p>Monitor device inventory and drill into per-device diagnostics.</p>
    </div>
    <span class="timestamp">Updated {new Date(data.fleet.updatedAt).toLocaleString()}</span>
  </header>

  {#if data.error}
    <div class="alert" role="alert">
      <strong>Unable to refresh fleet state.</strong>
      <span>{data.error}</span>
    </div>
  {/if}

  <div class="summary-grid">
    <Card title="Devices" subtitle="Audio agents connected to Fleet">
      <div class="summary">
        <div>
          <span class="summary-value">{data.fleet.online} / {data.fleet.total}</span>
          <span class="summary-label">Online</span>
        </div>
        <div>
          <span class="summary-value">{data.fleet.total - data.fleet.online}</span>
          <span class="summary-label">Offline</span>
        </div>
      </div>
    </Card>

    <Card title="Modules" subtitle="Inventory registered with Fleet">
      {#if data.layout?.modules?.length}
        <ul class="modules">
          {#each data.layout.modules as module (module.module)}
            <li>
              <strong>{module.module}</strong>
              <span>{Array.isArray(module.devices) ? module.devices.length : 0} devices</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">No modules registered.</p>
      {/if}
    </Card>
  </div>

  {#if data.fleet.devices.length > 0}
    <section aria-label="Fleet devices" class="device-section">
      <div class="device-grid">
        {#each data.fleet.devices as device (device.id)}
          <a class="device-card" href={resolve('/fleet/[id]', { id: device.id })}>
            <div class="device-header">
              <div>
                <h2>{device.name}</h2>
                <span class="device-id">{device.id}</span>
              </div>
              <span class={`status ${statusClass[device.status]}`}>{statusCopy[device.status]}</span>
            </div>
            <div class="device-meta">
              <span class="chip">{device.module}</span>
              <span class="chip secondary">{device.role}</span>
            </div>
            {#if device.detail}
              <p class="device-detail">{device.detail}</p>
            {/if}
          </a>
        {/each}
      </div>
    </section>
  {:else}
    <EmptyState title="No devices discovered" description="Add devices to the fleet to view status information." />
  {/if}
</div>

<style>
  .fleet-page {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-5);
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--spacing-4);
  }

  .page-header h1 {
    margin: 0 0 var(--spacing-2);
    font-size: var(--font-size-2xl);
  }

  .page-header p {
    margin: 0;
    color: var(--color-text-muted);
  }

  .timestamp {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .alert {
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    background: rgba(248, 113, 113, 0.12);
    border: 1px solid rgba(248, 113, 113, 0.35);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .summary-grid {
    display: grid;
    gap: var(--spacing-4);
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  }

  .summary {
    display: flex;
    gap: var(--spacing-4);
  }

  .summary-value {
    display: block;
    font-size: var(--font-size-2xl);
    font-weight: 600;
  }

  .summary-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .modules {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--spacing-2);
  }

  .modules li {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }

  .modules li span {
    color: var(--color-text-muted);
  }

  .muted {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .device-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .device-grid {
    display: grid;
    gap: var(--spacing-4);
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  }

  .device-card {
    display: grid;
    gap: var(--spacing-3);
    padding: var(--spacing-4);
    border-radius: var(--radius-lg);
    border: 1px solid rgba(148, 163, 184, 0.15);
    background: rgba(11, 23, 45, 0.35);
    text-decoration: none;
    color: inherit;
    transition: transform var(--transition-fast), border-color var(--transition-fast);
  }

  .device-card:hover {
    transform: translateY(-2px);
    border-color: rgba(148, 163, 184, 0.35);
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-3);
    align-items: flex-start;
  }

  .device-header h2 {
    margin: 0;
    font-size: var(--font-size-lg);
  }

  .device-id {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    display: block;
  }

  .status {
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .status.online {
    background: rgba(34, 197, 94, 0.15);
    color: rgb(134, 239, 172);
  }

  .status.offline {
    background: rgba(248, 113, 113, 0.15);
    color: rgb(248, 113, 113);
  }

  .status.error {
    background: rgba(249, 115, 22, 0.15);
    color: rgb(249, 115, 22);
  }

  .device-meta {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }

  .chip {
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: rgba(96, 165, 250, 0.18);
    color: rgb(96, 165, 250);
  }

  .chip.secondary {
    background: rgba(148, 163, 184, 0.16);
    color: rgba(226, 232, 240, 0.85);
  }

  .device-detail {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .timestamp {
      white-space: normal;
    }
  }
</style>
