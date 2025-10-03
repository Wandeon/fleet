<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
  const errors = data.layout.errors;
  const events = data.layout.events;

  const getModuleStatus = (module: typeof data.healthSummary.modules[0]) => {
    if (module.online === module.total) return 'ok';
    if (module.online === 0) return 'error';
    return 'warn';
  };

  const getDeviceStatus = (status: string) => {
    if (status === 'online') return 'ok';
    if (status === 'offline') return 'error';
    return 'warn';
  };
</script>

<div class="health-page">
  {#if data.error}
    <Card title="Health Status" subtitle="Unable to load health summary">
      <p class="error" role="alert">{data.error}</p>
    </Card>
  {:else if data.healthSummary}
    <Card
      title="Fleet Health Summary"
      subtitle={`Last updated ${new Date(data.healthSummary.updatedAt).toLocaleString()}`}
    >
      <div class="grid">
        {#each data.healthSummary.modules as module (module.module)}
          <div class="tile">
            <div class="header">
              <h3>{module.module}</h3>
              <StatusPill status={getModuleStatus(module)} />
            </div>
            <p class="value">{module.online} / {module.total}</p>
            <p class="hint">
              {module.total - module.online} offline or unknown
            </p>

            {#if module.devices.length > 0}
              <div class="devices">
                <h4>Devices</h4>
                <ul>
                  {#each module.devices as device (device.id)}
                    <li class="device-item">
                      <div class="device-header">
                        <span class="device-id">{device.id}</span>
                        <StatusPill status={getDeviceStatus(device.status)} label={device.status} />
                      </div>
                      {#if device.reason}
                        <p class="device-reason">{device.reason}</p>
                      {/if}
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </Card>
  {/if}
  <Card title="Recent errors">
    <ul class="timeline">
      {#each errors as item (item.id)}
        <li>
          <div>
            <strong>{item.message}</strong>
            <time>{new Date(item.timestamp).toLocaleString()}</time>
          </div>
          {#if item.actionLabel}
            <span class="chip">{item.actionLabel}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </Card>
  <Card title="Event feed">
    <ul class="timeline">
      {#each events as event (event.id)}
        <li>
          <div>
            <strong>{event.message}</strong>
            <time>{new Date(event.timestamp).toLocaleString()}</time>
          </div>
        </li>
      {/each}
    </ul>
  </Card>
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
    margin-top: var(--spacing-3);
    padding-top: var(--spacing-3);
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
    gap: var(--spacing-2);
  }

  .device-item {
    padding: var(--spacing-2);
    background: rgba(15, 23, 42, 0.5);
    border-radius: var(--radius-sm);
    border: 1px solid rgba(148, 163, 184, 0.1);
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-2);
  }

  .device-id {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-xs);
  }

  .device-reason {
    margin: var(--spacing-1) 0 0 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .error {
    color: var(--color-red-300);
    margin: 0;
  }
</style>
