<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Slider from '$lib/components/Slider.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import {
    pauseDevice,
    playOnDevices,
    resumeDevice,
    setDeviceVolume,
    stopDevice,
  } from '$lib/api/audio-operations';
  import type { PanelState } from '$lib/stores/app';
  import type {
    AudioDeviceSnapshot,
    AudioState,
  } from '$lib/types';

  interface Props {
    data: AudioState | null;
    panelState?: PanelState;
    variant?: 'compact' | 'full';
    title?: string;
    onRetry?: () => void;
  }

  let {
    data,
    panelState = 'success',
    variant = 'full',
    title = 'Audio',
    onRetry
  }: Props = $props();

  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '0:00';
    const total = Math.max(0, Math.round(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const computeStatus = (device: AudioDeviceSnapshot) => {
    if (device.status === 'error') return 'error';
    if (device.status === 'offline') return 'offline';
    if (device.playback.state === 'buffering') return 'warn';
    return 'ok';
  };

  let devices = $derived(data?.devices ?? []);
  let library = $derived(data?.library ?? []);

  let selectedTrackId = $state<string | null>(null);
  let playbackBusy = $state(false);
  let isPlaying = $derived(devices.some(d => d.playback.state === 'playing'));

  // Debug log devices
  $effect(() => {
    console.log(`📊 Audio devices count: ${devices.length}`, devices.map(d => d.name));
  });

  const handleVolumeChange = async (device: AudioDeviceSnapshot, volume: number) => {
    try {
      await setDeviceVolume(device.id, volume);
      console.log(`✅ Volume set to ${volume}% for ${device.id}`);
    } catch (error) {
      console.error('Volume change failed:', error);
    }
  };

  const handlePlayPause = async () => {
    if (playbackBusy) return;

    console.log(`🎵 ${isPlaying ? 'Pause' : 'Play'} button clicked`);
    playbackBusy = true;

    try {
      if (isPlaying) {
        // Pause all devices
        for (const device of devices) {
          if (device.playback.state === 'playing') {
            await pauseDevice(device.id);
            console.log(`⏸️ Paused ${device.id}`);
          }
        }
      } else {
        // Play selected track on all devices
        if (!selectedTrackId) {
          console.warn('⚠️ No track selected');
          playbackBusy = false;
          return;
        }

        const deviceIds = devices.map(d => d.id);

        console.log(`▶️ Playing track ${selectedTrackId} on devices ${deviceIds.join(', ')}`);

        await playOnDevices({
          deviceIds,
          trackId: selectedTrackId,
          syncMode: 'synced',
          resume: false,
          loop: true,
          startAtSeconds: 0,
        });

        console.log('✅ Playback started');
      }
    } catch (error) {
      console.error('❌ Playback error:', error);
    } finally {
      playbackBusy = false;
      setTimeout(() => {
        if (onRetry) onRetry();
      }, 1000);
    }
  };

  const handleStop = async () => {
    if (playbackBusy) return;

    console.log('🛑 Stop button clicked');
    playbackBusy = true;

    try {
      for (const device of devices) {
        await stopDevice(device.id);
        console.log(`⏹️ Stopped ${device.id}`);
      }
      console.log('✅ All devices stopped');
    } catch (error) {
      console.error('❌ Stop error:', error);
    } finally {
      playbackBusy = false;
      setTimeout(() => {
        if (onRetry) onRetry();
      }, 1000);
    }
  };

  const toggleTrackSelection = (trackId: string) => {
    console.log(`🎯 Track checkbox clicked: ${trackId}`);
    if (selectedTrackId === trackId) {
      selectedTrackId = null;
      console.log(`☑️ Track ${trackId} deselected`);
    } else {
      selectedTrackId = trackId;
      console.log(`✅ Track ${trackId} selected (only one allowed)`);
    }
  };
</script>

<Card {title} subtitle="Synchronized audio playback control">
  {#if panelState === 'loading'}
    <div class="loading">
      <Skeleton variant="block" height="10rem" />
      <Skeleton variant="block" height="7rem" />
      <Skeleton variant="block" height="12rem" />
    </div>
  {:else if panelState === 'error'}
    <div class="error-state" role="alert">
      <p>Audio subsystem unreachable. Retry fetching telemetry?</p>
      <Button variant="primary" on:click={() => onRetry?.()}>Retry</Button>
    </div>
  {:else if !data || devices.length === 0}
    <EmptyState
      title="No audio devices discovered"
      description="Bring a player online or pair a Pi to begin."
    >
      <svelte:fragment slot="icon">🔈</svelte:fragment>
      <svelte:fragment slot="actions">
        <Button variant="secondary" on:click={() => onRetry?.()}>Refresh</Button>
      </svelte:fragment>
    </EmptyState>
  {:else}
    <div class="audio-simple">
      <!-- Device Cards -->
      <div class="device-cards">
        {#each devices as device (device.id)}
          <div class="device-card">
            <div class="device-header">
              <h3>{device.name}</h3>
              <StatusPill status={computeStatus(device)} />
            </div>

            <div class="device-info">
              <div class="info-row">
                <span class="label">Status:</span>
                <span class="value">
                  {device.playback.state === 'playing' ? 'Playing' :
                   device.playback.state === 'paused' ? 'Paused' :
                   device.playback.state === 'buffering' ? 'Buffering' :
                   'Idle'}
                </span>
              </div>

              {#if device.playback.state === 'playing' || device.playback.state === 'paused'}
                <div class="info-row">
                  <span class="label">Track:</span>
                  <span class="value">{device.playback.trackTitle ?? 'Unknown'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Position:</span>
                  <span class="value">
                    {formatDuration(device.playback.positionSeconds)} / {formatDuration(device.playback.durationSeconds)}
                  </span>
                </div>
                <div class="info-row">
                  <span class="label">Started:</span>
                  <span class="value">{formatTime(device.lastUpdated)}</span>
                </div>
              {/if}
            </div>

            <div class="device-volume">
              <Slider
                label="Volume"
                min={0}
                max={200}
                value={device.volumePercent}
                unit="%"
                on:change={(event) => handleVolumeChange(device, event.detail)}
              />
            </div>
          </div>
        {/each}
      </div>

      <!-- Playback Controls -->
      <div class="playback-controls">
        <h3>Playback Controls</h3>
        <div class="control-buttons">
          <Button
            variant="primary"
            size="lg"
            disabled={playbackBusy}
            on:click={handlePlayPause}
          >
            {#if playbackBusy}
              {isPlaying ? 'Pausing...' : 'Starting...'}
            {:else}
              {isPlaying ? 'Pause' : 'Play'}
            {/if}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            disabled={playbackBusy}
            on:click={handleStop}
          >
            {playbackBusy ? 'Stopping...' : 'Stop'}
          </Button>
        </div>
      </div>

      <!-- Library -->
      <div class="library">
        <h3>Library</h3>
        {#if library.length === 0}
          <p class="empty-message">No tracks in library</p>
        {:else}
          <div class="track-list">
            {#each library as track (track.id)}
              <label class="track-item">
                <input
                  type="checkbox"
                  checked={selectedTrackId === track.id}
                  onchange={() => toggleTrackSelection(track.id)}
                />
                <div class="track-info">
                  <span class="track-title">{track.title}</span>
                  <span class="track-meta">
                    {track.artist ?? 'Unknown artist'} · {formatDuration(track.durationSeconds)}
                  </span>
                </div>
              </label>
            {/each}
          </div>
        {/if}
      </div>
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

  .audio-simple {
    display: grid;
    gap: var(--spacing-5);
  }

  .device-cards {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-4);
  }

  .device-card {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
    display: grid;
    gap: var(--spacing-3);
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .device-header h3 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .device-info {
    display: grid;
    gap: var(--spacing-2);
  }

  .info-row {
    display: flex;
    gap: var(--spacing-2);
    font-size: var(--font-size-sm);
  }

  .info-row .label {
    color: var(--color-text-muted);
    min-width: 5rem;
  }

  .info-row .value {
    font-weight: 500;
  }

  .device-volume {
    margin-top: var(--spacing-2);
  }

  .playback-controls {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
  }

  .playback-controls h3 {
    margin: 0 0 var(--spacing-3) 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .control-buttons {
    display: flex;
    gap: var(--spacing-3);
  }

  .library {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
  }

  .library h3 {
    margin: 0 0 var(--spacing-3) 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .empty-message {
    color: var(--color-text-muted);
    margin: 0;
  }

  .track-list {
    display: grid;
    gap: var(--spacing-2);
  }

  .track-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-3);
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s;
  }

  .track-item:hover {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(148, 163, 184, 0.3);
  }

  .track-item input[type="checkbox"] {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
  }

  .track-info {
    display: grid;
    gap: 0.25rem;
    flex: 1;
  }

  .track-title {
    font-weight: 500;
  }

  .track-meta {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }
</style>
