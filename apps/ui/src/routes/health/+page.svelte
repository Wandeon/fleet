<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  const formatModuleName = (module: string) =>
    module
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  const getModuleStatus = (module: typeof data.healthSummary.modules[number]) => {
    const unknown = module.total - module.online;
    if (unknown === module.total) return 'offline';
    if (unknown > 0) return 'warn';
    return 'ok';
  };
</script>

<div class="health-page">
  {#if data.error}
    <EmptyState title="Unable to load health data" description={data.error} />
  {:else if data.healthSummary}
    <Card
      title="Module health summary"
      subtitle={`Last updated ${new Date(data.healthSummary.updatedAt).toLocaleString()}`}
    >
      <div class="grid">
        {#each data.healthSummary.modules as module (module.module)}
          {@const unknown = module.total - module.online}
          {@const status = getModuleStatus(module)}
          <div class="tile">
            <div class="header">
              <h3>{formatModuleName(module.module)}</h3>
              <StatusPill {status} />
            </div>
            <p class="value">{module.online}/{module.total} online</p>
            {#if unknown > 0}
              <p class="hint">{unknown} unknown/offline</p>
            {/if}
            <div class="devices">
              <h4>Devices:</h4>
              <ul>
                {#each module.devices as device (device.id)}
                  <li class={`device-${device.status}`}>
                    <span class="device-id">{device.id}</span>
                    <span class="device-status">{device.status}</span>
                    {#if device.reason}
                      <span class="device-reason">({device.reason})</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          </div>
        {/each}
      </div>
    </Card>
  {:else}
    <EmptyState title="No health data available" description="Loading health summary..." />
  {/if}
</div>

<style>
  .health-page {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .grid {
    display: grid;
    gap: var(--spacing-3);
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  }

  .tile {
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    background: rgba(11, 23, 45, 0.6);
    display: grid;
    gap: var(--spacing-2);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-2);
  }

  .header h3 {
    margin: 0;
    font-size: var(--font-size-md);
  }

  .value {
    margin: 0;
    font-size: var(--font-size-xl);
  }

  .hint {
    margin: 0;
    color: var(--color-text-muted);
  }

  .link {
    font-size: var(--font-size-xs);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-brand);
  }

  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-3);
  }

  .timeline li {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-2);
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    padding-bottom: var(--spacing-2);
  }

  .timeline strong {
    display: block;
  }

  .timeline time {
    display: block;
    margin-top: 0.25rem;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .chip {
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    background: rgba(56, 189, 248, 0.12);
    font-size: var(--font-size-xs);
  }

  .devices {
    margin-top: var(--spacing-2);
    padding-top: var(--spacing-2);
    border-top: 1px solid rgba(148, 163, 184, 0.1);
  }

  .devices h4 {
    margin: 0 0 var(--spacing-2) 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .devices ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-1);
  }

  .devices li {
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
    font-size: var(--font-size-sm);
  }

  .device-id {
    font-family: monospace;
    color: var(--color-text);
  }

  .device-status {
    text-transform: uppercase;
    font-size: var(--font-size-xs);
    letter-spacing: 0.05em;
  }

  .device-online .device-status {
    color: var(--color-success);
  }

  .device-offline .device-status,
  .device-unknown .device-status {
    color: var(--color-error);
  }

  .device-reason {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }
</style>
