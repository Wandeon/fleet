<script lang="ts">
  import type { PageData } from './$types';
  import Card from '$lib/components/Card.svelte';
  import { resolve } from '$app/paths';

  export let data: PageData;

  const logsBase = resolve('/logs');
  $: logsHref = `${logsBase}?level=debug&search=${encodeURIComponent(data.device.id)}`;


  const statusClass: Record<'online' | 'offline' | 'error', string> = {
    online: 'online',
    offline: 'offline',
    error: 'error'
  };

  const levelClass: Record<'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal', string> = {
    trace: 'debug',
    debug: 'debug',
    info: 'info',
    warn: 'warn',
    error: 'error',
    fatal: 'error'
  };

  const statusLabel: Record<'online' | 'offline' | 'error', string> = {
    online: 'Online',
    offline: 'Offline',
    error: 'Error'
  };

  const formatTimestamp = (iso: string | null | undefined): string => {
    if (!iso) return 'Unknown';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };
</script>

<svelte:head>
  <title>{data.device.name} - Device Details</title>
</svelte:head>

<div class="device-page">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href={resolve('/fleet')}>Fleet</a>
    <span aria-hidden="true">›</span>
    <span>{data.device.name}</span>
  </nav>

  <header class="page-header">
    <div>
      <h1>{data.device.name}</h1>
      <p>{data.device.id}</p>
    </div>
    <span class={`status ${statusClass[data.device.status]}`}>{statusLabel[data.device.status]}</span>
  </header>

  <div class="grid">
    <section class="primary">
      <Card title="Device status" subtitle="Operational metrics and capabilities">
        <dl class="meta">
          <div>
            <dt>Module</dt>
            <dd>{data.device.module}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{data.device.role}</dd>
          </div>
          <div>
            <dt>Last seen</dt>
            <dd>{formatTimestamp(data.device.lastSeen)}</dd>
          </div>
          <div>
            <dt>State</dt>
            <dd>{data.device.status === 'online' ? 'Connected' : data.device.reason ?? 'Offline'}</dd>
          </div>
        </dl>

        {#if data.device.capabilities.length}
          <div class="capabilities">
            {#each data.device.capabilities as capability (capability)}
              <span class="chip">{capability}</span>
            {/each}
          </div>
        {/if}

        {#if data.device.playback}
          <div class="playback">
            <h2>Playback</h2>
            <dl>
              <div>
                <dt>State</dt>
                <dd>{data.device.playback.state}</dd>
              </div>
              <div>
                <dt>Track</dt>
                <dd>{data.device.playback.trackTitle ?? '—'}</dd>
              </div>
              <div>
                <dt>Elapsed</dt>
                <dd>{data.device.playback.positionSeconds}s</dd>
              </div>
            </dl>
          </div>
        {/if}
      </Card>

      <Card title="Recent logs" subtitle="Last 10 entries for this device">
        {#if data.logs.length === 0}
          <p class="muted">No log entries captured for this device yet.</p>
        {:else}
          <ul class="log-list">
            {#each data.logs as entry (entry.id + entry.ts)}
              <li class={`log ${levelClass[entry.level]}`}>
                <div class="log-header">
                  <span class="level">{entry.level.toUpperCase()}</span>
                  <time datetime={entry.ts}>{formatTimestamp(entry.ts)}</time>
                </div>
                <p>{entry.msg}</p>
                <div class="log-meta">
                  <span>{entry.service}</span>
                  <span>{entry.host}</span>
                  {#if entry.correlationId}
                    <span class="correlation">{entry.correlationId}</span>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a class="logs-link" href={logsHref}>
          Open in log explorer →
        </a>
      </Card>
    </section>

    <aside class="secondary">
      <Card title="Troubleshooting" subtitle="Live actions coming soon">
        <p class="muted">Command execution from the control plane is gated behind backend safeguards. Use SSH or the worker queue to dispatch restarts until API endpoints are available.</p>
      </Card>
    </aside>
  </div>
</div>

<style>
  .device-page {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-5);
  }

  .breadcrumb {
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
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

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-4);
  }

  .page-header h1 {
    margin: 0;
    font-size: var(--font-size-2xl);
  }

  .page-header p {
    margin: 0;
    color: var(--color-text-muted);
  }

  .status {
    padding: 0.35rem 0.75rem;
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

  .grid {
    display: grid;
    gap: var(--spacing-4);
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  }

  .primary,
  .secondary {
    display: grid;
    gap: var(--spacing-4);
  }

  .meta {
    display: grid;
    gap: var(--spacing-3);
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    margin: 0;
  }

  .meta dt {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .meta dd {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  .capabilities {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    margin-top: var(--spacing-3);
  }

  .chip {
    padding: 0.2rem 0.65rem;
    border-radius: 999px;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: rgba(96, 165, 250, 0.18);
    color: rgb(96, 165, 250);
  }

  .playback {
    margin-top: var(--spacing-4);
    border-top: 1px solid rgba(148, 163, 184, 0.15);
    padding-top: var(--spacing-3);
  }

  .playback h2 {
    margin: 0 0 var(--spacing-2);
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .playback dl {
    display: grid;
    gap: var(--spacing-2);
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    margin: 0;
  }

  .playback dt {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
  }

  .playback dd {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  .log-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-3);
  }

  .log {
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid rgba(148, 163, 184, 0.12);
    background: rgba(11, 23, 45, 0.35);
    display: grid;
    gap: var(--spacing-2);
  }

  .log.debug {
    border-color: rgba(94, 234, 212, 0.2);
  }

  .log.info {
    border-color: rgba(96, 165, 250, 0.2);
  }

  .log.warn {
    border-color: rgba(250, 204, 21, 0.25);
  }

  .log.error {
    border-color: rgba(248, 113, 113, 0.25);
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-3);
    flex-wrap: wrap;
  }

  .log-header .level {
    font-size: var(--font-size-xs);
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  .log-header time {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .log p {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  .log-meta {
    display: flex;
    gap: var(--spacing-3);
    flex-wrap: wrap;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .correlation {
    font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  }

  .logs-link {
    display: inline-block;
    margin-top: var(--spacing-3);
    font-size: var(--font-size-sm);
    color: var(--color-brand);
    text-decoration: none;
  }

  .logs-link:hover {
    text-decoration: underline;
  }

  .muted {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }

    .page-header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
