<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
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
  let uploadBusy = false;
  let deleteBusy: Record<string, boolean> = {};
  let banner: { type: 'success' | 'error'; message: string } | null = null;
  let playBusy: Record<string, boolean> = {};
  let volumeChanging: Record<string, boolean> = {};
  let liquidsoapBusy = false;

  const openAudioFiles = () => {
    const filesRoute = resolve('/files?folder=audio');
    void goto(filesRoute);
  };

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

  const handleUpload = () => {
    if (!browser || uploadBusy) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.mp3,.ogg,.wav,.flac,.m4a,.aac';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;

      if (file.size > 50 * 1024 * 1024) {
        showError('File too large. Maximum size is 50 MB.');
        return;
      }

      uploadBusy = true;
      try {
        await uploadMusicFile(file);
        showSuccess(`Uploaded ${file.name}`);
        await loadData();
      } catch (error) {
        console.error('Upload error', error);
        showError(error instanceof Error ? error.message : 'Upload failed');
      } finally {
        uploadBusy = false;
      }
    });

    input.click();
  };

  const handleDelete = async (filename: string) => {
    if (!browser || deleteBusy[filename]) return;
    if (!confirm(`Delete ${filename}?`)) return;

    deleteBusy = { ...deleteBusy, [filename]: true };
    try {
      await deleteMusicFile(filename);
      showSuccess(`Deleted ${filename}`);
      await loadData();
    } catch (error) {
      console.error('Delete error', error);
      showError(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      delete deleteBusy[filename];
      deleteBusy = { ...deleteBusy };
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
              <div class="liquidsoap-controls">
                <button
                  class="control-btn play"
                  on:click={handleLiquidsoapPlay}
                  disabled={liquidsoapBusy}
                >
                  ▶ Play
                </button>
                <button
                  class="control-btn stop"
                  on:click={handleLiquidsoapStop}
                  disabled={liquidsoapBusy}
                >
                  ⏹ Stop
                </button>
                <button
                  class="control-btn skip"
                  on:click={handleLiquidsoapSkip}
                  disabled={liquidsoapBusy}
                >
                  ⏭ Skip
                </button>
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
          <div class="actions">
            <Button variant="ghost" on:click={openAudioFiles}>Open audio folder</Button>
            <Button variant="ghost" on:click={loadData}>Refresh</Button>
            <Button variant="primary" disabled={uploadBusy} on:click={handleUpload}>
              {uploadBusy ? 'Uploading…' : 'Upload Music'}
            </Button>
          </div>
        </header>

        {#if musicLibrary.length === 0}
          <EmptyState
            title="No music files"
            description="Upload audio files to start streaming to Pi devices."
          >
            <svelte:fragment slot="icon">🎵</svelte:fragment>
            <svelte:fragment slot="actions">
              <Button variant="primary" on:click={handleUpload}>Upload Music</Button>
            </svelte:fragment>
          </EmptyState>
        {:else}
          <table>
            <thead>
              <tr>
                <th scope="col">Filename</th>
                <th scope="col">Size</th>
                <th scope="col">Modified</th>
                <th scope="col">Play on Devices</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each musicLibrary as file (file.filename)}
                <tr>
                  <th scope="row">🎵 {file.filename}</th>
                  <td>{formatBytes(file.size)}</td>
                  <td>{new Date(file.modifiedAt).toLocaleString()}</td>
                  <td>
                    <div class="play-buttons">
                      {#if piAudio01}
                        {#if piAudio01.playback.state === 'playing'}
                          <button
                            class="play-btn stop-btn"
                            disabled={!!playBusy['pi-audio-01']}
                            on:click={() => handleStopDevice('pi-audio-01')}
                            title="Stop Pi Audio 01"
                          >
                            ⏹
                          </button>
                        {:else}
                          <button
                            class="play-btn"
                            disabled={!!playBusy['pi-audio-01']}
                            on:click={() => handlePlayStream('pi-audio-01')}
                            title="Play on Pi Audio 01"
                          >
                            ▶
                          </button>
                        {/if}
                      {/if}
                      {#if piAudio02}
                        {#if piAudio02.playback.state === 'playing'}
                          <button
                            class="play-btn stop-btn"
                            disabled={!!playBusy['pi-audio-02']}
                            on:click={() => handleStopDevice('pi-audio-02')}
                            title="Stop Pi Audio 02"
                          >
                            ⏹
                          </button>
                        {:else}
                          <button
                            class="play-btn"
                            disabled={!!playBusy['pi-audio-02']}
                            on:click={() => handlePlayStream('pi-audio-02')}
                            title="Play on Pi Audio 02"
                          >
                            ▶
                          </button>
                        {/if}
                      {/if}
                    </div>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!!deleteBusy[file.filename]}
                      on:click={() => handleDelete(file.filename)}
                    >
                      {deleteBusy[file.filename] ? 'Deleting…' : 'Delete'}
                    </Button>
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

      <section class="stream-info">
        <header>
          <h2>Stream Information</h2>
        </header>
        <div class="stream-details">
          <div class="info-row">
            <span>Stream URL:</span>
            <code>{streamingStatus?.streamUrl ?? 'http://icecast:8000/fleet.mp3'}</code>
          </div>
          {#if fleetMount}
            <div class="info-row">
              <span>Bitrate:</span>
              <strong>{fleetMount.bitrate} kbps</strong>
            </div>
            <div class="info-row">
              <span>Format:</span>
              <strong>MP3 Stereo</strong>
            </div>
          {/if}
          <p class="info-note">
            Pi devices can be configured to stream from this URL using the "stream" source mode.
          </p>
        </div>
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--spacing-3);
  }

  .music-library .actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .music-library table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: var(--radius-md);
    overflow: hidden;
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

  .stream-info header {
    margin-bottom: var(--spacing-3);
  }

  .stream-details {
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-md);
    padding: var(--spacing-4);
    background: rgba(12, 21, 41, 0.5);
    display: grid;
    gap: var(--spacing-3);
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-3);
  }

  .info-row span {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .info-row code {
    background: rgba(15, 23, 42, 0.9);
    padding: 0.3rem 0.6rem;
    border-radius: var(--radius-sm);
    font-family: 'Courier New', monospace;
    font-size: var(--font-size-sm);
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .info-note {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    margin-top: var(--spacing-2);
    padding-top: var(--spacing-3);
    border-top: 1px solid rgba(148, 163, 184, 0.12);
  }

  .play-buttons {
    display: flex;
    gap: var(--spacing-2);
  }

  .play-btn {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: rgb(59, 130, 246);
    padding: 0.4rem 0.6rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .play-btn:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.5);
  }

  .play-btn.stop-btn {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: rgb(239, 68, 68);
  }

  .play-btn.stop-btn:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .play-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  .liquidsoap-controls {
    display: flex;
    gap: var(--spacing-2);
    margin-top: var(--spacing-2);
  }

  .control-btn {
    flex: 1;
    padding: var(--spacing-2);
    border-radius: var(--radius-md);
    border: 1px solid;
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: 500;
    transition: all 0.2s;
  }

  .control-btn.play {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.3);
    color: rgb(34, 197, 94);
  }

  .control-btn.play:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.25);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .control-btn.stop {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: rgb(239, 68, 68);
  }

  .control-btn.stop:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .control-btn.skip {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
    color: rgb(59, 130, 246);
  }

  .control-btn.skip:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.5);
  }

  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
