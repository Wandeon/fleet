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

  let isControlling = false;
  let controlStatus = '';

  function retry() {
    dispatch('retry');
    onRetry?.();
  }

  async function controlPower(powerState: 'on' | 'off') {
    if (!data || isControlling) return;

    isControlling = true;
    controlStatus = `Turning ${powerState}...`;

    try {
      // Mock API call - replace with actual API endpoint
      const response = await fetch('/api/video/power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: powerState })
      });

      if (response.ok) {
        data.power = powerState;
        controlStatus = `Display ${powerState === 'on' ? 'turned on' : 'turned off'}`;
      } else {
        controlStatus = 'Power control failed';
      }
    } catch (error) {
      controlStatus = `Power control error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    setTimeout(() => {
      isControlling = false;
      controlStatus = '';
      onRetry?.(); // Refresh data
    }, 2000);
  }

  async function selectInput(input: string) {
    if (!data || isControlling) return;

    isControlling = true;
    controlStatus = `Switching to ${input}...`;

    try {
      // Mock API call - replace with actual API endpoint
      const response = await fetch('/api/video/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: input })
      });

      if (response.ok) {
        data.input = input;
        controlStatus = `Input switched to ${input}`;
      } else {
        controlStatus = 'Input switch failed';
      }
    } catch (error) {
      controlStatus = `Input control error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    setTimeout(() => {
      isControlling = false;
      controlStatus = '';
      onRetry?.(); // Refresh data
    }, 2000);
  }

  async function controlVolume(volume: number) {
    if (!data || isControlling) return;

    data.volume = volume;

    // Mock API call - replace with actual API endpoint
    try {
      await fetch('/api/video/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume })
      });
    } catch (error) {
      console.warn('Volume control error:', error);
    }
  }

  async function toggleMute() {
    if (!data || isControlling) return;

    isControlling = true;
    const newMuteState = !data.muted;
    controlStatus = newMuteState ? 'Muting...' : 'Unmuting...';

    try {
      // Mock API call - replace with actual API endpoint
      const response = await fetch('/api/video/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: newMuteState })
      });

      if (response.ok) {
        data.muted = newMuteState;
        controlStatus = newMuteState ? 'Muted' : 'Unmuted';
      } else {
        controlStatus = 'Mute control failed';
      }
    } catch (error) {
      controlStatus = `Mute control error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    setTimeout(() => {
      isControlling = false;
      controlStatus = '';
    }, 1500);
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
        {#if controlStatus}
          <div class="control-status">
            <span class="status-text">{controlStatus}</span>
          </div>
        {/if}
      </div>
      <div class="controls">
        <div class="power">
          <Button
            variant={data.power === 'on' ? 'primary' : 'secondary'}
            disabled={isControlling}
            on:click={() => controlPower('on')}
            aria-pressed={data.power === 'on'}
          >
            {isControlling && controlStatus.includes('on') ? 'Turning On...' : 'Power On'}
          </Button>
          <Button
            variant={data.power === 'off' ? 'primary' : 'secondary'}
            disabled={isControlling}
            on:click={() => controlPower('off')}
            aria-pressed={data.power === 'off'}
          >
            {isControlling && controlStatus.includes('off') ? 'Turning Off...' : 'Power Off'}
          </Button>
        </div>
        <div class="inputs">
          <span class="input-label">Input Source:</span>
          {#each data.availableInputs as input (input)}
            <Button
              variant={input === data.input ? 'primary' : 'ghost'}
              disabled={isControlling}
              on:click={() => selectInput(input)}
              aria-pressed={input === data.input}
            >
              {input}
            </Button>
          {/each}
        </div>
        <Slider
          label="Output volume"
          min={0}
          max={100}
          value={data.volume}
          unit="%"
          on:change={(e) => controlVolume(e.detail)}
        />
        <Button
          variant={data.muted ? 'primary' : 'ghost'}
          disabled={isControlling}
          on:click={toggleMute}
          aria-pressed={data.muted}
        >
          {isControlling && controlStatus.includes('mut') ? controlStatus : (data.muted ? 'Unmute' : 'Mute')}
        </Button>
        <p class="meta">
          Last signal: {new Date(data.lastSignal).toLocaleTimeString()}
          {#if data.power === 'on'}
            <span class="power-indicator on">● ON</span>
          {:else}
            <span class="power-indicator off">● OFF</span>
          {/if}
        </p>
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
    position: relative;
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

  .control-status {
    position: absolute;
    top: var(--spacing-3);
    left: var(--spacing-3);
    right: var(--spacing-3);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .status-text {
    font-size: var(--font-size-sm);
    font-weight: 500;
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
    align-items: center;
  }

  .input-label {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
    margin-right: var(--spacing-2);
  }

  .meta {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .power-indicator {
    font-weight: 600;
    font-size: var(--font-size-xs);
  }

  .power-indicator.on {
    color: var(--color-green-500);
  }

  .power-indicator.off {
    color: var(--color-red-500);
  }

  @media (max-width: 900px) {
    .video-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
