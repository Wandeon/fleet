<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Slider from '$lib/components/Slider.svelte';
  import DeviceTile from '$lib/components/DeviceTile.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { useMocks } from '$lib/stores/app';
  import type { PanelState } from '$lib/stores/app';
  import type { AudioDevice, AudioState } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  export let data: AudioState | null = null;
  export let state: PanelState = 'success';
  export let variant: 'compact' | 'full' = 'full';
  export let title = 'Audio';
  export let onRetry: (() => void) | undefined;

  const dispatch = createEventDispatcher();
  $: usingMocks = $useMocks;

  function formatVolume(value: number) {
    return `${Math.round(value)}%`;
  }

  function retry() {
    dispatch('retry');
    onRetry?.();
  }

  function deviceStatus(device: AudioDevice) {
    if (device.status === 'error') return 'error';
    if (device.status === 'offline') return 'offline';
    return 'ok';
  }
</script>

<Card title={title} subtitle="Dual Pi audio routing">
  {#if state === 'loading'}
    <div class="stack">
      <Skeleton variant="line" />
      <Skeleton variant="block" height="7rem" />
      <div class="device-skeletons">
        <Skeleton variant="block" height="6rem" />
        <Skeleton variant="block" height="6rem" />
      </div>
    </div>
  {:else if state === 'error'}
    <div class="error-state" role="alert">
      <p>Audio subsystem unreachable. pi-audio-02 didn’t respond. Retry?</p>
      <Button variant="primary" on:click={retry}>Retry</Button>
    </div>
  {:else if state === 'empty'}
    <EmptyState title="No audio devices discovered" description="Bring a Pi online to start playback.">
      <svelte:fragment slot="icon">🔈</svelte:fragment>
      <svelte:fragment slot="action">
        <Button variant="secondary" disabled={usingMocks}>Scan again</Button>
      </svelte:fragment>
    </EmptyState>
  {:else if data}
    <div class={`audio-grid ${variant}`}>
      <section class="controls">
        <div class="actions">
          <Button variant="primary">Play on both</Button>
          <Button variant="secondary">Pause</Button>
        </div>
        <Slider label="Master volume" min={0} max={200} value={data.masterVolume} unit="%" />
        {#if data.nowPlaying}
          <div class="now-playing">
            {#if data.nowPlaying.art}
              <img src={data.nowPlaying.art} alt="Album art" width="72" height="72" />
            {/if}
            <div>
              <span class="label">Now playing</span>
              <strong>{data.nowPlaying.track}</strong>
              <span class="artist">{data.nowPlaying.artist}</span>
            </div>
          </div>
        {:else}
          <p class="idle">Idle · Queue a track to begin.</p>
        {/if}
      </section>
      <section class="devices">
        {#each data.devices as device (device.id)}
          <DeviceTile title={device.name} subtitle={device.nowPlaying ?? 'Idle'} status={deviceStatus(device)}>
            <div class="device-actions">
              <Button variant="ghost" aria-label={`Previous track on ${device.name}`}>⏮</Button>
              <Button variant="ghost" aria-label={`Play or pause ${device.name}`} aria-pressed={device.isPlaying}>
                {device.isPlaying ? '⏸' : '▶️'}
              </Button>
              <Button variant="ghost" aria-label={`Next track on ${device.name}`}>⏭</Button>
            </div>
            <div class="device-volume">
              <Slider
                label="Volume"
                min={0}
                max={200}
                value={device.volume}
                unit="%"
                displayValue={true}
              />
              <span class="volume-value">{formatVolume(device.volume)}</span>
            </div>
            <svelte:fragment slot="actions">
              <time class="timestamp">Updated {new Date(device.lastUpdated).toLocaleTimeString()}</time>
            </svelte:fragment>
          </DeviceTile>
        {/each}
      </section>
      <section class="file-actions">
        <h3>File actions</h3>
        <div class="buttons">
          <Button disabled={usingMocks}>Upload</Button>
          <Button variant="secondary" disabled={usingMocks}>Replace fallback</Button>
        </div>
        {#if usingMocks}
          <p class="hint">Connect to the live API to enable file management.</p>
        {/if}
      </section>
    </div>
  {:else}
    <EmptyState title="Audio state unavailable" description="No data received from audio service." />
  {/if}
</Card>

<style>
  .stack {
    display: grid;
    gap: var(--spacing-3);
  }

  .device-skeletons {
    display: grid;
    gap: var(--spacing-3);
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  }

  .error-state {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .audio-grid {
    display: grid;
    gap: var(--spacing-4);
  }

  .audio-grid.compact .file-actions {
    display: none;
  }

  .controls {
    display: grid;
    gap: var(--spacing-3);
    align-items: center;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .now-playing {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--spacing-3);
    align-items: center;
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(12, 21, 41, 0.7);
  }

  .now-playing img {
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }

  .now-playing .label {
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    color: var(--color-text-muted);
    letter-spacing: 0.08em;
  }

  .now-playing strong {
    display: block;
    font-size: var(--font-size-lg);
  }

  .now-playing .artist {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .idle {
    margin: 0;
    color: var(--color-text-muted);
  }

  .devices {
    display: grid;
    gap: var(--spacing-3);
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  }

  .device-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .device-volume {
    display: grid;
    gap: 0.35rem;
  }

  .volume-value {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .timestamp {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .file-actions {
    display: grid;
    gap: var(--spacing-2);
  }

  .file-actions h3 {
    margin: 0;
    font-size: var(--font-size-md);
  }

  .file-actions .buttons {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }

  .hint {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }
</style>
