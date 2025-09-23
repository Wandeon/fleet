<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import type { PanelState } from '$lib/stores/app';
  import type { CameraState } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  export let data: CameraState | null = null;
  export let state: PanelState = 'success';
  export let onRetry: (() => void) | undefined;
  export let title = 'Camera';

  const dispatch = createEventDispatcher();

  function retry() {
    dispatch('retry');
    onRetry?.();
  }
</script>

<Card title={title} subtitle="Motion insights">
  {#if state === 'loading'}
    <div class="stack">
      <Skeleton variant="block" height="10rem" />
      <Skeleton variant="line" />
      <Skeleton variant="line" />
    </div>
  {:else if state === 'error'}
    <div class="error-state" role="alert">
      <p>Camera bridge timeout. Check stream pipeline.</p>
      <Button variant="primary" on:click={retry}>Retry</Button>
    </div>
  {:else if state === 'empty'}
    <EmptyState title="No camera events yet" description="Connect a camera to get started.">
      <svelte:fragment slot="icon">🎥</svelte:fragment>
    </EmptyState>
  {:else if data}
    <div class="camera-grid">
      <div class="preview">
        <img src={data.previewImage} alt="Camera preview" />
      </div>
      <div class="details">
        <p class="meta">Last motion: {data.lastMotion ? new Date(data.lastMotion).toLocaleTimeString() : 'None'}</p>
        <Button variant="secondary">View log</Button>
        <ul class="events">
          {#each data.events as event (event.id)}
            <li>
              <strong>{event.description}</strong>
              <time>{new Date(event.timestamp).toLocaleTimeString()}</time>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {:else}
    <EmptyState title="Camera data missing" description="No frames received from camera service." />
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

  .camera-grid {
    display: grid;
    gap: var(--spacing-4);
    grid-template-columns: minmax(16rem, 1.8fr) minmax(0, 1fr);
  }

  .preview {
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(11, 23, 45, 0.7);
  }

  .preview img {
    display: block;
    width: 100%;
    height: auto;
  }

  .details {
    display: grid;
    gap: var(--spacing-3);
  }

  .meta {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .events {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--spacing-2);
  }

  .events li {
    padding: var(--spacing-2);
    border-radius: var(--radius-md);
    border: 1px solid rgba(148, 163, 184, 0.15);
    background: rgba(11, 23, 45, 0.6);
  }

  .events time {
    display: block;
    margin-top: 0.35rem;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  @media (max-width: 900px) {
    .camera-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
