<script lang="ts">
  import AudioModule from '$lib/modules/AudioModule.svelte';
  import AudioDeviceCard from '$lib/components/AudioDeviceCard.svelte';
  import { createModuleStateStore, type PanelState } from '$lib/stores/app';
  import { invalidate } from '$app/navigation';
  import type { PageData } from './$types';
  import { onMount, onDestroy } from 'svelte';
  import { fetchAudioDevices } from '$lib/api/audio-device-control';
  import type { AudioDeviceSnapshot } from '$lib/types';

  export let data: PageData;

  const audioStateStore = createModuleStateStore('audio');
  $: panelState = deriveState($audioStateStore, data.error);

  function deriveState(base: PanelState, error: string | null): PanelState {
    if (error && base === 'success') return 'error';
    return base;
  }

  const refresh = () => invalidate('app:audio');

  // Device control state
  let devices: AudioDeviceSnapshot[] = [];
  let devicesLoading = true;
  let devicesError: string | null = null;
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let toastMessage: string | null = null;
  let toastType: 'success' | 'error' = 'success';

  const loadDevices = async () => {
    try {
      devices = await fetchAudioDevices();
      devicesError = null;
    } catch (error) {
      devicesError = error instanceof Error ? error.message : 'Failed to load devices';
    } finally {
      devicesLoading = false;
    }
  };

  const handleDeviceRefresh = () => {
    loadDevices();
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    toastMessage = message;
    toastType = type;
    setTimeout(() => {
      toastMessage = null;
    }, 4000);
  };

  onMount(() => {
    loadDevices();
    // Poll for device updates every 5 seconds
    pollingInterval = setInterval(loadDevices, 5000);
  });

  onDestroy(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
  });
</script>

<div class="audio-page">
  <!-- Device Controls Section -->
  <section class="device-controls-section">
    <header>
      <h1>Audio Device Controls</h1>
      <p>Direct control of audio players for stream and fallback playback</p>
    </header>

    {#if toastMessage}
      <div class={`toast ${toastType}`} role="alert">
        {toastMessage}
        <button type="button" on:click={() => (toastMessage = null)} aria-label="Dismiss">×</button>
      </div>
    {/if}

    {#if devicesLoading}
      <p>Loading devices...</p>
    {:else if devicesError}
      <div class="error-message" role="alert">
        <p>{devicesError}</p>
        <button type="button" on:click={loadDevices}>Retry</button>
      </div>
    {:else if devices.length === 0}
      <p class="empty-state">No audio devices found</p>
    {:else}
      <div class="device-grid">
        {#each devices as device (device.id)}
          <AudioDeviceCard
            {device}
            on:refresh={handleDeviceRefresh}
            on:success={(e) => showToast(e.detail, 'success')}
            on:error={(e) => showToast(e.detail, 'error')}
          />
        {/each}
      </div>
    {/if}
  </section>

  <!-- Library Management Section -->
  <section class="library-section">
    <AudioModule data={data.audio} state={panelState} onRetry={refresh} />

    {#if data.error && panelState !== 'error'}
      <p class="error-note" role="alert">{data.error}</p>
    {/if}
  </section>
</div>

<style>
  .audio-page {
    display: grid;
    gap: var(--spacing-6);
  }

  .device-controls-section,
  .library-section {
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-lg);
    padding: var(--spacing-5);
    background: rgba(12, 21, 41, 0.55);
  }

  .device-controls-section header {
    margin-bottom: var(--spacing-4);
  }

  .device-controls-section h1 {
    margin: 0 0 var(--spacing-2) 0;
    font-size: var(--font-size-2xl);
  }

  .device-controls-section p {
    margin: 0;
    color: var(--color-text-muted);
  }

  .toast {
    margin: var(--spacing-3) 0;
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-3);
  }

  .toast.success {
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.4);
    color: rgb(187, 247, 208);
  }

  .toast.error {
    background: rgba(248, 113, 113, 0.12);
    border: 1px solid rgba(248, 113, 113, 0.4);
    color: rgb(248, 113, 113);
  }

  .toast button {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.1rem;
    cursor: pointer;
  }

  .device-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
    gap: var(--spacing-4);
  }

  .error-message {
    padding: var(--spacing-4);
    background: rgba(248, 113, 113, 0.12);
    border: 1px solid rgba(248, 113, 113, 0.4);
    border-radius: var(--radius-md);
    color: rgb(248, 113, 113);
  }

  .error-message button {
    margin-top: var(--spacing-2);
    padding: 0.4rem 0.8rem;
    background: rgba(248, 113, 113, 0.2);
    border: 1px solid rgba(248, 113, 113, 0.6);
    border-radius: var(--radius-sm);
    color: inherit;
    cursor: pointer;
  }

  .empty-state {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .error-note {
    margin-top: var(--spacing-3);
    color: var(--color-warning);
  }
</style>
