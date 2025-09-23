<script lang="ts">
  import StatusPill from './StatusPill.svelte';
  import type { StatusLevel } from './types';

  export let title: string;
  export let subtitle: string;
  export let status: StatusLevel = 'ok';
  export let busy = false;

  const hasActions = !!$$slots.actions;
</script>

<div class={`device-tile ${busy ? 'busy' : ''}`} aria-busy={busy}>
  <div class="summary">
    <div class="icon" aria-hidden="true">
      <slot name="icon">🎛️</slot>
    </div>
    <div class="meta">
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </div>
    <StatusPill {status} />
  </div>
  <div class="content">
    <slot />
  </div>
  {#if hasActions}
    <div class="actions">
      <slot name="actions" />
    </div>
  {/if}
</div>

<style>
  .device-tile {
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    background: rgba(12, 21, 41, 0.65);
  }

  .device-tile.busy {
    opacity: 0.7;
  }

  .summary {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--spacing-3);
    align-items: center;
  }

  .icon {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.75rem;
    display: grid;
    place-items: center;
    background: rgba(56, 189, 248, 0.12);
    font-size: 1.1rem;
  }

  .meta h3 {
    margin: 0;
    font-size: var(--font-size-md);
  }

  .meta p {
    margin: 0.1rem 0 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .content {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    align-items: center;
  }

  .actions {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }
</style>
