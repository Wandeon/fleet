<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Slider from '$lib/components/Slider.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import type { PanelState } from '$lib/stores/app';
  import type { VideoState } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  export let data: VideoState | null = null;
  export let state: PanelState = 'success';
  export let onRetry: (() => void) | undefined;
  export let title = 'Video';

  const dispatch = createEventDispatcher();

  function retry() {
    dispatch('retry');
    onRetry?.();
  }
</script>

<Card title={title} subtitle="TV wall control">
  {#if state === 'loading'}
    <div class="stack">
      <Skeleton variant="block" height="9rem" />
      <Skeleton variant="line" />
      <Skeleton variant="line" />
    </div>
  {:else if state === 'error'}
    <div class="error-state" role="alert">
      <p>Video controller offline. Attempt to reconnect?</p>
      <Button variant="primary" on:click={retry}>Retry</Button>
    </div>
  {:else if state === 'empty'}
    <EmptyState title="No displays discovered" description="Add a display or HDMI sink to manage video output.">
      <svelte:fragment slot="icon">📺</svelte:fragment>
    </EmptyState>
  {:else if data}
    <div class="video-grid">
      <div class="preview" role="img" aria-label="Video preview placeholder">
        <img src={data.previewImage} alt="Video preview" loading="lazy" />
      </div>
      <div class="controls">
        <div class="power">
          <Button variant="primary" aria-pressed={data.power === 'on'}>Power On</Button>
          <Button variant="secondary" aria-pressed={data.power === 'off'}>Power Off</Button>
        </div>
        <div class="inputs">
          {#each data.availableInputs as input (input)}
            <Button variant={input === data.input ? 'primary' : 'ghost'} aria-pressed={input === data.input}>
              {input}
            </Button>
          {/each}
        </div>
        <Slider label="Output volume" min={0} max={100} value={data.volume} unit="" />
        <Button variant="ghost" aria-pressed={data.muted}>{data.muted ? 'Unmute' : 'Mute'}</Button>
        <p class="meta">Last signal: {new Date(data.lastSignal).toLocaleTimeString()}</p>
      </div>
    </div>
  {:else}
    <EmptyState title="Video data missing" description="No telemetry received from video service." />
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

  .video-grid {
    display: grid;
    gap: var(--spacing-4);
    grid-template-columns: minmax(16rem, 2fr) minmax(0, 1.5fr);
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

  .controls {
    display: grid;
    gap: var(--spacing-3);
  }

  .power,
  .inputs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .meta {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  @media (max-width: 900px) {
    .video-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
