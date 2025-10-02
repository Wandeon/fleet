<script lang="ts">
  import AudioModule from '$lib/modules/AudioModule.svelte';
  import { createModuleStateStore, type PanelState } from '$lib/stores/app';
  import { invalidate } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  const audioStateStore = createModuleStateStore('audio');
  $: panelState = deriveState($audioStateStore, data.error);

  function deriveState(base: PanelState, error: string | null): PanelState {
    if (error && base === 'success') return 'error';
    return base;
  }

  const refresh = () => invalidate('app:audio');
</script>

<AudioModule data={data.audio} state={panelState} onRetry={refresh} />

{#if data.error && panelState !== 'error'}
  <p class="error-note" role="alert">{data.error}</p>
{/if}

{#if data.audio && panelState === 'success'}
  <div class="audio-overview">
    <section class="library-section">
      <h2>Library Overview</h2>
      {#if data.audio.library && data.audio.library.length > 0}
        <table class="library-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Artist</th>
              <th>Duration</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {#each data.audio.library as track (track.id)}
              <tr>
                <td>{track.title}</td>
                <td>{track.artist ?? '—'}</td>
                <td>
                  {Math.floor(track.durationSeconds / 60)}:{String(
                    Math.floor(track.durationSeconds % 60)
                  ).padStart(2, '0')}
                </td>
                <td>{track.tags?.join(', ') ?? '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="empty-state">No tracks in library</p>
      {/if}
    </section>

    <section class="devices-section">
      <h2>Device Playback Status</h2>
      {#if data.audio.devices && data.audio.devices.length > 0}
        <ul class="device-list">
          {#each data.audio.devices as device (device.id)}
            <li class="device-item">
              <div class="device-header">
                <strong>{device.name}</strong>
                <span class={`status-badge status-${device.status}`}>{device.status}</span>
              </div>
              <div class="device-details">
                <span>State: <strong>{device.playback.state}</strong></span>
                <span>Volume: <strong>{device.volumePercent}%</strong></span>
                {#if device.playback.trackTitle}
                  <span>Playing: <strong>{device.playback.trackTitle}</strong></span>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty-state">No devices available</p>
      {/if}
    </section>
  </div>
{/if}

<style>
  .error-note {
    margin-top: var(--spacing-3);
    color: var(--color-warning);
  }

  .audio-overview {
    margin-top: var(--spacing-4);
    display: grid;
    gap: var(--spacing-4);
  }

  .library-section,
  .devices-section {
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-md);
    padding: var(--spacing-4);
    background: rgba(12, 21, 41, 0.55);
  }

  .library-section h2,
  .devices-section h2 {
    margin: 0 0 var(--spacing-3) 0;
    font-size: var(--font-size-lg);
  }

  .library-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm);
  }

  .library-table th {
    text-align: left;
    padding: var(--spacing-2);
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .library-table td {
    padding: var(--spacing-2);
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .library-table tbody tr:hover {
    background: rgba(148, 163, 184, 0.05);
  }

  .device-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-2);
  }

  .device-item {
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-sm);
    padding: var(--spacing-3);
    background: rgba(15, 23, 42, 0.6);
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-2);
  }

  .device-details {
    display: flex;
    gap: var(--spacing-3);
    flex-wrap: wrap;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .status-badge {
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-online {
    background: rgba(34, 197, 94, 0.15);
    color: rgb(34, 197, 94);
  }

  .status-offline {
    background: rgba(148, 163, 184, 0.15);
    color: rgba(148, 163, 184, 0.9);
  }

  .status-error {
    background: rgba(248, 113, 113, 0.15);
    color: rgb(248, 113, 113);
  }

  .empty-state {
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>
