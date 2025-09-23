<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<Card title="Event log" subtitle="Audit trail of recent actions">
  {#if data.error && !data.logs}
    <p role="alert">{data.error}</p>
  {:else if data.logs}
    <ul class="log-list">
      {#each data.logs.entries as entry (entry.id)}
        <li>
          <div>
            <time>{new Date(entry.timestamp).toLocaleString()}</time>
            <p>{entry.message}</p>
          </div>
          <StatusPill status={entry.severity === 'error' ? 'error' : entry.severity === 'warning' ? 'warn' : 'ok'} label={entry.severity} />
        </li>
      {/each}
    </ul>
  {:else}
    <p>No log entries available.</p>
  {/if}
</Card>

<style>
  .log-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-3);
  }

  .log-list li {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-3);
    align-items: center;
    padding-bottom: var(--spacing-2);
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  time {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  p {
    margin: 0.25rem 0 0;
  }
</style>
