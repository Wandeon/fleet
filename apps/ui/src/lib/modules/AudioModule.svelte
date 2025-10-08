<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import {
    getStreamingStatus,
    getMusicLibrary,
    uploadMusicFile,
    deleteMusicFile,
    playLiquidsoap,
    stopLiquidsoap,
    skipLiquidsoapTrack,
    type StreamingSystemStatus,
    type MusicLibraryFile,
  } from '$lib/api/streaming-operations';
  import { fetchAudioDevices, playDeviceSource, stopDevice, setDeviceVolume, type AudioDeviceSnapshot } from '$lib/api/audio-device-control';
  import type { PanelState } from '$lib/stores/app';

  export let state: PanelState = 'success';
  export let variant: 'compact' | 'full' = 'full';
  export let title = 'Audio Streaming';
  export let onRetry: (() => void) | undefined;

  let streamingStatus: StreamingSystemStatus | null = null;
  let musicLibrary: MusicLibraryFile[] = [];
  let audioDevices: AudioDeviceSnapshot[] = [];
  let loading = true;
  let banner: { type: 'success' | 'error'; message: string } | null = null;
  let playBusy: Record<string, boolean> = {};
  let volumeChanging: Record<string, boolean> = {};
  let liquidsoapBusy = false;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDuration = (isoString: string | null) => {
    if (!isoString) return '—';
    const start = new Date(isoString).valueOf();
    const now = Date.now();
    const diff = now - start;
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const showSuccess = (message: string) => {
    banner = { type: 'success', message };
    setTimeout(() => {
      if (banner?.message === message) banner = null;
    }, 4000);
  };

  const showError = (message: string) => {
    banner = { type: 'error', message };
  };

  const loadData = async () => {
    loading = true;
    try {
      const [status, library, devices] = await Promise.all([
        getStreamingStatus().catch(() => null),
        getMusicLibrary().catch(() => []),
        fetchAudioDevices().catch(() => []),
      ]);
      streamingStatus = status;
      musicLibrary = library;
      audioDevices = devices;
    } catch (error) {
      console.error('Failed to load streaming data', error);
    } finally {
      loading = false;
    }
  };

  const handlePlayStream = async (deviceId: string) => {
    if (!browser || playBusy[deviceId]) return;

    playBusy = { ...playBusy, [deviceId]: true };
    try {
      await playDeviceSource(deviceId, 'stream');
      showSuccess(`Playing on ${deviceId}`);
      await loadData();
    } catch (error) {
      console.error('Play error', error);
      showError(error instanceof Error ? error.message : 'Play failed');
    } finally {
      delete playBusy[deviceId];
      playBusy = { ...playBusy };
    }
  };

  const handleStopDevice = async (deviceId: string) => {
    if (!browser || playBusy[deviceId]) return;

    playBusy = { ...playBusy, [deviceId]: true };
    try {
      await stopDevice(deviceId);
      showSuccess(`Stopped ${deviceId}`);
      await loadData();
    } catch (error) {
      console.error('Stop error', error);
      showError(error instanceof Error ? error.message : 'Stop failed');
    } finally {
      delete playBusy[deviceId];
      playBusy = { ...playBusy };
    }
  };

  const handleVolumeChange = async (deviceId: string, volume: number) => {
    if (!browser || volumeChanging[deviceId]) return;

    volumeChanging = { ...volumeChanging, [deviceId]: true };
    try {
      // Convert from 0-100 to 0-2.0 range
      await setDeviceVolume(deviceId, volume / 50);
      await loadData();
    } catch (error) {
      console.error('Volume change error', error);
      showError(error instanceof Error ? error.message : 'Volume change failed');
    } finally {
      delete volumeChanging[deviceId];
      volumeChanging = { ...volumeChanging };
    }
  };

  const handleLiquidsoapPlay = async () => {
    if (!browser || liquidsoapBusy) return;
    liquidsoapBusy = true;
    try {
      await playLiquidsoap();
      showSuccess('Liquidsoap playback started');
      await loadData();
    } catch (error) {
      console.error('Liquidsoap play error', error);
      showError(error instanceof Error ? error.message : 'Failed to start playback');
    } finally {
      liquidsoapBusy = false;
    }
  };

  const handleLiquidsoapStop = async () => {
    if (!browser || liquidsoapBusy) return;
    liquidsoapBusy = true;
    try {
      await stopLiquidsoap();
      showSuccess('Liquidsoap playback stopped');
      await loadData();
    } catch (error) {
      console.error('Liquidsoap stop error', error);
      showError(error instanceof Error ? error.message : 'Failed to stop playback');
    } finally {
      liquidsoapBusy = false;
    }
  };

  const handleLiquidsoapSkip = async () => {
    if (!browser || liquidsoapBusy) return;
    liquidsoapBusy = true;
    try {
      await skipLiquidsoapTrack();
      showSuccess('Skipped to next track');
      await loadData();
    } catch (error) {
      console.error('Liquidsoap skip error', error);
      showError(error instanceof Error ? error.message : 'Failed to skip track');
    } finally {
      liquidsoapBusy = false;
    }
  };

  onMount(() => {
    loadData();
  });

  $: totalSize = musicLibrary.reduce((sum, file) => sum + file.size, 0);
  $: piAudio01 = audioDevices.find(d => d.id === 'pi-audio-01');
  $: piAudio02 = audioDevices.find(d => d.id === 'pi-audio-02');
  $: fleetMount = streamingStatus?.icecast?.mounts?.find(m => m.mount === 'fleet.mp3');
</script>

<Card {title} subtitle={variant === 'compact' ? 'Streaming system health' : 'Liquidsoap + Icecast streaming infrastructure'}>
  {#if loading}
    <div class="loading">
      <Skeleton variant="block" height="8rem" />
      <Skeleton variant="block" height="12rem" />
    </div>
  {:else if state === 'error'}
    <div class="error-state" role="alert">
      <p>Streaming subsystem unreachable. Retry fetching status?</p>
      <Button variant="primary" on:click={() => onRetry?.()}>Retry</Button>
    </div>
  {:else if variant === 'compact'}
    <div class="compact-view">
      <div class="compact-metrics">
        <div class="metric">
          <span>Icecast</span>
          <strong>{streamingStatus?.icecast?.online ? '● Online' : '○ Offline'}</strong>
        </div>
        <div class="metric">
          <span>Liquidsoap</span>
          <strong>{streamingStatus?.liquidsoap?.online ? '● Online' : '○ Offline'}</strong>
        </div>
        <div class="metric">
          <span>Music files</span>
          <strong>{streamingStatus?.liquidsoap?.libraryFiles ?? 0}</strong>
        </div>
        <div class="metric">
          <span>Listeners</span>
          <strong>{streamingStatus?.icecast?.totalListeners ?? 0}</strong>
        </div>
      </div>
      <Button variant="ghost" on:click={loadData}>Refresh</Button>
    </div>
  {:else}
    <div class="streaming-layout">
      {#if banner}
        <div class={`banner ${banner.type}`} role="status">
          <span>{banner.message}</span>
          <button type="button" on:click={() => (banner = null)} aria-label="Dismiss">×</button>
        </div>
      {/if}

      <section class="status-grid">
        <div class="status-card">
          <header>
            <h3>Icecast Server</h3>
            <StatusPill status={streamingStatus?.icecast?.online ? 'ok' : 'error'} />
          </header>
          <div class="status-body">
            {#if streamingStatus?.icecast?.online}
              <div class="stat">
                <span>Uptime</span>
                <strong>{formatDuration(streamingStatus.icecast.serverStart)}</strong>
              </div>
              <div class="stat">
                <span>Listeners</span>
                <strong>{streamingStatus.icecast.totalListeners}</strong>
              </div>
              <div class="stat">
                <span>Mounts</span>
                <strong>{streamingStatus.icecast.mounts.length}</strong>
              </div>
              {#if fleetMount}
                <div class="stat">
                  <span>Stream</span>
                  <strong>{fleetMount.mount} @ {fleetMount.bitrate}kbps</strong>
                </div>
              {/if}
            {:else}
              <p class="offline-message">Server offline or unreachable</p>
            {/if}
          </div>
        </div>

        <div class="status-card">
          <header>
            <h3>Liquidsoap</h3>
            <StatusPill status={streamingStatus?.liquidsoap?.online ? 'ok' : 'error'} />
          </header>
          <div class="status-body">
            {#if streamingStatus?.liquidsoap?.online}
              <div class="stat">
                <span>Library files</span>
                <strong>{streamingStatus.liquidsoap.libraryFiles}</strong>
              </div>
              <div class="stat">
                <span>Library size</span>
                <strong>{formatBytes(streamingStatus.liquidsoap.librarySize)}</strong>
              </div>
            {:else}
              <p class="offline-message">Service offline or unreachable</p>
            {/if}
          </div>
        </div>

        <div class="status-card">
          <header>
            <h3>Pi Audio 01</h3>
            <StatusPill status={piAudio01?.status === 'online' ? 'ok' : 'offline'} />
          </header>
          <div class="status-body">
            {#if piAudio01}
              <div class="stat">
                <span>Name</span>
                <strong>{piAudio01.name}</strong>
              </div>
              <div class="stat">
                <span>Playback</span>
                <strong>{piAudio01.playback.state}</strong>
              </div>
              {#if piAudio01.playback.syncGroup}
                <div class="stat sync-indicator">
                  <span>Mode</span>
                  <strong class="sync-badge">🎵 Synchronized</strong>
                </div>
              {:else if piAudio01.playback.state === 'playing'}
                <div class="stat">
                  <span>Mode</span>
                  <strong class="fallback-badge">⚠️ Fallback</strong>
                </div>
              {/if}
              <div class="volume-control">
                <label for="volume-pi-audio-01">
                  <span>Volume</span>
                  <strong>{piAudio01.volumePercent}%</strong>
                </label>
                <input
                  id="volume-pi-audio-01"
                  type="range"
                  min="0"
                  max="100"
                  value={piAudio01.volumePercent}
                  disabled={volumeChanging['pi-audio-01'] || piAudio01.status !== 'online'}
                  on:change={(e) => handleVolumeChange('pi-audio-01', Number(e.currentTarget.value))}
                />
              </div>
            {:else}
              <p class="offline-message">Device not registered</p>
            {/if}
          </div>
        </div>

        <div class="status-card">
          <header>
            <h3>Pi Audio 02</h3>
            <StatusPill status={piAudio02?.status === 'online' ? 'ok' : 'offline'} />
          </header>
          <div class="status-body">
            {#if piAudio02}
              <div class="stat">
                <span>Name</span>
                <strong>{piAudio02.name}</strong>
              </div>
              <div class="stat">
                <span>Playback</span>
                <strong>{piAudio02.playback.state}</strong>
              </div>
              {#if piAudio02.playback.syncGroup}
                <div class="stat sync-indicator">
                  <span>Mode</span>
                  <strong class="sync-badge">🎵 Synchronized</strong>
                </div>
              {:else if piAudio02.playback.state === 'playing'}
                <div class="stat">
                  <span>Mode</span>
                  <strong class="fallback-badge">⚠️ Fallback</strong>
                </div>
              {/if}
              <div class="volume-control">
                <label for="volume-pi-audio-02">
                  <span>Volume</span>
                  <strong>{piAudio02.volumePercent}%</strong>
                </label>
                <input
                  id="volume-pi-audio-02"
                  type="range"
                  min="0"
                  max="100"
                  value={piAudio02.volumePercent}
                  disabled={volumeChanging['pi-audio-02'] || piAudio02.status !== 'online'}
                  on:change={(e) => handleVolumeChange('pi-audio-02', Number(e.currentTarget.value))}
                />
              </div>
            {:else}
              <p class="offline-message">Device not registered</p>
            {/if}
          </div>
        </div>
      </section>

      <section class="music-library">
        <header>
          <h2>Music Library</h2>
        </header>

        {#if musicLibrary.length === 0}
          <EmptyState
            title="No music files"
            description="Add audio files using the file manager to start streaming to Pi devices."
          >
            <svelte:fragment slot="icon">🎵</svelte:fragment>
          </EmptyState>
        {:else}
          <table>
            <thead>
              <tr>
                <th scope="col">Filename</th>
                <th scope="col">Size</th>
                <th scope="col">Modified</th>
                <th scope="col">Playback</th>
                <th scope="col">Connect Devices</th>
              </tr>
            </thead>
            <tbody>
              {#each musicLibrary as file (file.filename)}
                <tr>
                  <th scope="row">🎵 {file.filename}</th>
                  <td>{formatBytes(file.size)}</td>
                  <td>{new Date(file.modifiedAt).toLocaleString()}</td>
                  <td>
                    <button
                      class="file-control-btn"
                      disabled={liquidsoapBusy}
                      on:click={() => handleLiquidsoapPlay()}
                      title="Play this file"
                    >
                      ▶ Play
                    </button>
                  </td>
                  <td>
                    <div class="device-checkboxes">
                      {#if piAudio01}
                        <label class="device-checkbox">
                          <input
                            type="checkbox"
                            checked={piAudio01.playback.state === 'playing'}
                            disabled={!!playBusy['pi-audio-01'] || piAudio01.status !== 'online'}
                            on:change={(e) => {
                              if (e.currentTarget.checked) {
                                handlePlayStream('pi-audio-01');
                              } else {
                                handleStopDevice('pi-audio-01');
                              }
                            }}
                          />
                          <span>{piAudio01.name}</span>
                        </label>
                      {/if}
                      {#if piAudio02}
                        <label class="device-checkbox">
                          <input
                            type="checkbox"
                            checked={piAudio02.playback.state === 'playing'}
                            disabled={!!playBusy['pi-audio-02'] || piAudio02.status !== 'online'}
                            on:change={(e) => {
                              if (e.currentTarget.checked) {
                                handlePlayStream('pi-audio-02');
                              } else {
                                handleStopDevice('pi-audio-02');
                              }
                            }}
                          />
                          <span>{piAudio02.name}</span>
                        </label>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>

          <div class="library-summary">
            <span>Total: {musicLibrary.length} files ({formatBytes(totalSize)})</span>
          </div>
        {/if}
      </section>
    </div>
  {/if}
</Card>

<style>
  .loading {
    display: grid;
    gap: var(--spacing-4);
  }

  .error-state {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .compact-view {
    display: grid;
    gap: var(--spacing-4);
  }

  .compact-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: var(--spacing-3);
  }

  .metric {
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    background: rgba(12, 21, 41, 0.6);
  }

  .metric span {
    display: block;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .metric strong {
    display: block;
    margin-top: 0.4rem;
    font-size: var(--font-size-lg);
  }

  .streaming-layout {
    display: grid;
    gap: var(--spacing-5);
  }

  .banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .banner.success {
    background: rgba(34, 197, 94, 0.12);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .banner.error {
    background: rgba(248, 113, 113, 0.12);
    border-color: rgba(248, 113, 113, 0.4);
  }

  .banner button {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.2rem;
    cursor: pointer;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: var(--spacing-4);
  }

  .status-card {
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: rgba(12, 21, 41, 0.5);
  }

  .status-card header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3);
    border-bottom: 1px solid rgba(148, 163, 184, 0.12);
    background: rgba(15, 23, 42, 0.6);
  }

  .status-card h3 {
    font-size: var(--font-size-base);
    font-weight: 600;
    margin: 0;
  }

  .status-body {
    padding: var(--spacing-3);
    display: grid;
    gap: var(--spacing-2);
  }

  .stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stat span {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .stat strong {
    font-size: var(--font-size-sm);
  }

  .offline-message {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    font-style: italic;
  }

  .music-library header {
    margin-bottom: var(--spacing-3);
  }

  .music-library table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: var(--radius-md);
    overflow: hidden;
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .music-library table thead,
  .music-library table tbody,
  .music-library table tr {
    display: table;
    width: 100%;
    table-layout: fixed;
  }

  @media (max-width: 768px) {
    .music-library table {
      min-width: 600px;
    }
  }

  .music-library th,
  .music-library td {
    padding: var(--spacing-3);
    text-align: left;
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
  }

  .music-library thead th {
    background: rgba(15, 23, 42, 0.7);
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .music-library tbody tr:hover {
    background: rgba(148, 163, 184, 0.05);
  }

  .library-summary {
    padding: var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: var(--radius-md);
    background: rgba(12, 21, 41, 0.4);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .file-control-btn {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: rgb(34, 197, 94);
    padding: 0.4rem 0.8rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: 500;
    transition: all 0.2s;
  }

  .file-control-btn:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.25);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .file-control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .device-checkboxes {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .device-checkbox {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    cursor: pointer;
    font-size: var(--font-size-sm);
  }

  .device-checkbox input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: rgb(59, 130, 246);
  }

  .device-checkbox input[type="checkbox"]:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .device-checkbox span {
    user-select: none;
  }

  .volume-control {
    display: grid;
    gap: var(--spacing-2);
  }

  .volume-control label {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .volume-control label span {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .volume-control label strong {
    font-size: var(--font-size-sm);
  }

  .volume-control input[type="range"] {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(148, 163, 184, 0.2);
    outline: none;
    -webkit-appearance: none;
  }

  .volume-control input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgb(59, 130, 246);
    cursor: pointer;
  }

  .volume-control input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgb(59, 130, 246);
    cursor: pointer;
    border: none;
  }

  .volume-control input[type="range"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .volume-control input[type="range"]:disabled::-webkit-slider-thumb {
    cursor: not-allowed;
  }

  .volume-control input[type="range"]:disabled::-moz-range-thumb {
    cursor: not-allowed;
  }

  .sync-indicator {
    background: rgba(34, 197, 94, 0.08);
    padding: var(--spacing-2);
    border-radius: var(--radius-sm);
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .sync-badge {
    color: rgb(34, 197, 94);
    font-weight: 600;
    font-size: var(--font-size-sm);
  }

  .fallback-badge {
    color: rgb(251, 191, 36);
    font-weight: 600;
    font-size: var(--font-size-sm);
  }
</style>
