<script lang="ts">
  import type { PageData } from './$types';
  import type { ConsolePanelDefinition } from '$lib/console/panels';
  import type { SystemHealthSummary } from '$lib/types';
  import FleetPanel from '$lib/components/console/FleetPanel.svelte';
  import AudioPanel from '$lib/components/console/AudioPanel.svelte';
  import VideoPanel from '$lib/components/console/VideoPanel.svelte';
  import CameraPanel from '$lib/components/console/CameraPanel.svelte';
  import LogsPanel from '$lib/components/console/LogsPanel.svelte';

  export let data: PageData;

  $: panels = (data.panels ?? []) as ConsolePanelDefinition[];

  $: health = (data.health ?? {
    data: null,
    error: null,
  }) as {
    data: SystemHealthSummary | null;
    error: string | null;
  };

  const formatTimestamp = (value: string | null | undefined) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleString();
  };

  $: componentEntries = Object.entries(health.data?.components ?? {});
</script>

<svelte:head>
  <title>Fleet Console</title>
</svelte:head>

<div class="console-header">
  <h1>Fleet console</h1>
  <p class="console-subtitle">Unified control surface for fleet operations.</p>
</div>

<div class="console-body">
  <section class="panel-grid" aria-label="Console panels">
    {#if panels.length === 0}
      <p class="panel-empty" role="status">No panels available for this environment.</p>
    {:else}
      {#each panels as panel (panel.id)}
        <article class="panel-frame" id={panel.anchor} aria-labelledby={`${panel.anchor}-title`}>
          <header class="panel-header">
            <h2 id={`${panel.anchor}-title`}>{panel.title}</h2>
            <p class="panel-description">{panel.description}</p>
          </header>
          <div class="panel-content" role="presentation">
            {#if panel.id === 'fleet'}
              <FleetPanel />
            {:else if panel.id === 'audio'}
              <AudioPanel />
            {:else if panel.id === 'video'}
              <VideoPanel />
            {:else if panel.id === 'camera'}
              <CameraPanel />
            {:else if panel.id === 'logs'}
              <LogsPanel />
            {:else}
              <p class="panel-placeholder">Panel content will render here once wired.</p>
            {/if}
          </div>
        </article>
      {/each}
    {/if}
  </section>

  <aside class="health-summary" aria-label="System health">
    <h2>System health</h2>
    {#if health.error}
      <p class="health-error" role="status">Unable to load health summary. {health.error}</p>
    {:else if health.data}
      <dl class="health-meta">
        <div>
          <dt>Overall</dt>
          <dd>{health.data.overall}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatTimestamp(health.data.timestamp)}</dd>
        </div>
      </dl>
      {#if componentEntries.length > 0}
        <ul class="health-components">
          {#each componentEntries as [identifier, status] (identifier)}
            <li>
              <span class="component-id">{identifier}</span>
              <span class={`component-status status-${status.toLowerCase()}`}>{status}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="health-empty">No device components reported.</p>
      {/if}
    {:else}
      <p class="health-loading" role="status">Loading health summary…</p>
    {/if}
  </aside>
</div>

<style>
  .console-header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .console-header h1 {
    font-size: clamp(1.8rem, 2.4vw, 2.4rem);
    margin: 0;
  }

  .console-subtitle {
    margin: 0;
    color: var(--text-muted, #8b949e);
    font-size: 1rem;
  }

  .console-body {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(18rem, 28rem);
    gap: 1.5rem;
  }

  @media (max-width: 960px) {
    .console-body {
      grid-template-columns: 1fr;
    }
  }

  .panel-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 1.25rem;
  }

  .panel-empty {
    grid-column: 1 / -1;
    margin: 0;
    padding: 1.5rem;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 0.75rem;
    text-align: center;
    color: var(--text-muted, #8b949e);
  }

  .panel-frame {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .panel-description {
    margin: 0.25rem 0 0;
    color: var(--text-muted, #8b949e);
    font-size: 0.95rem;
  }

  .panel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 20rem;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .panel-content:has(.panel-placeholder) {
    align-items: center;
    justify-content: center;
    min-height: 6rem;
    border: 1px dashed rgba(255, 255, 255, 0.08);
  }

  .panel-placeholder {
    margin: 0;
    color: var(--text-muted, #8b949e);
    font-size: 0.9rem;
  }

  .health-summary {
    padding: 1.25rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .health-summary h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .health-meta {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem;
  }

  .health-meta div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.04);
  }

  .health-meta dt {
    margin: 0;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted, #8b949e);
  }

  .health-meta dd {
    margin: 0;
    font-size: 0.95rem;
  }

  .health-components {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .health-components li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
  }

  .component-id {
    font-family: var(--font-mono, 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace);
    font-size: 0.85rem;
  }

  .component-status {
    font-size: 0.85rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    text-transform: capitalize;
    background: rgba(255, 255, 255, 0.1);
  }

  .status-up {
    color: #3fb950;
    background: rgba(63, 185, 80, 0.15);
  }

  .status-degraded {
    color: #d29922;
    background: rgba(210, 153, 34, 0.15);
  }

  .status-down {
    color: #f85149;
    background: rgba(248, 81, 73, 0.15);
  }

  .status-unknown {
    color: #8b949e;
    background: rgba(139, 148, 158, 0.15);
  }

  .health-error,
  .health-loading,
  .health-empty {
    margin: 0;
    color: var(--text-muted, #8b949e);
    font-size: 0.95rem;
  }

  .health-error {
    color: #f85149;
  }
</style>
