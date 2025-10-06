<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Slider from '$lib/components/Slider.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import { createEventDispatcher, onMount } from 'svelte';
  import { invalidate } from '$app/navigation';
  import { isFeatureEnabled } from '$lib/config/features';
  import {
    fetchRecordingTimeline,
    generateLivePreviewUrl,
    getVideoOverview,
    setVideoInput,
    setVideoMute,
    setVideoPower,
    setVideoVolume,
    fetchVideoLibrary,
    syncVideo,
    type VideoLibraryItem,
  } from '$lib/api/video-operations';
  import { mockApi } from '$lib/api/mock';
  import { USE_MOCKS } from '$lib/api/client';
  import type { PanelState } from '$lib/stores/app';
  import type { VideoRecordingSegment, VideoState } from '$lib/types';
  import { browser } from '$app/environment';

  export let data: VideoState | null = null;
  export let state: PanelState = 'success';
  export let variant: 'compact' | 'full' = 'full';
  export let title = 'Video';
  export let onRetry: (() => void) | undefined;

  const dispatch = createEventDispatcher();

  const statusToPill = (state: VideoState) => {
    if (state.power === 'off') return 'offline';
    if (state.livePreview?.status === 'error') return 'error';
    if (state.livePreview?.status === 'connecting') return 'warn';
    return 'ok';
  };

  let statusMessage: string | null = null;
  let busy = false;
  let liveUrl: string | null = null;
  let liveLoading = false;
  let timeline: VideoRecordingSegment[] = data?.recordings ?? [];
  let selectedSegmentId: string | null = timeline[0]?.id ?? null;
  let segmentPosition = 0;
  let library: VideoLibraryItem[] = [];
  let syncBusy: Record<string, boolean> = {};

  $: timeline = data?.recordings ?? timeline;
  $: selectedSegmentId =
    selectedSegmentId && timeline.every((item) => item.id !== selectedSegmentId)
      ? (timeline[0]?.id ?? null)
      : selectedSegmentId;
  $: selectedSegment = timeline.find((item) => item.id === selectedSegmentId) ?? null;
  $: segmentDuration = selectedSegment
    ? Math.max(
        0,
        Math.round(
          (new Date(selectedSegment.end).valueOf() - new Date(selectedSegment.start).valueOf()) /
            1000
        )
      )
    : 0;

  const broadcastRefresh = () => {
    dispatch('refresh');
    invalidate('app:video');
    onRetry?.();
  };

  const openVideoControls = () => {
    const videoRoute = resolve('/video');
    void goto(videoRoute);
  };

  const showMessage = (message: string) => {
    statusMessage = message;
    setTimeout(() => {
      if (statusMessage === message) statusMessage = null;
    }, 4000);
  };

  const handlePower = async (power: 'on' | 'off') => {
    if (!data || busy) return;
    busy = true;
    try {
      const result = await setVideoPower(power);
      data = result.state;
      showMessage(`Display ${power === 'on' ? 'powered on' : 'powered off'} (Job: ${result.jobId})`);
    } catch (error) {
      console.error('set power', error);
      if (error && typeof error === 'object' && 'status' in error && error.status === 409) {
        showMessage('Device busy - please wait for current operation to complete');
      } else {
        const msg = error instanceof Error ? error.message : 'Power control failed';
        showMessage(msg);
      }
    } finally {
      busy = false;
      broadcastRefresh();
    }
  };

  const handleInput = async (inputId: string) => {
    if (!data || busy) return;
    busy = true;
    try {
      const result = await setVideoInput(inputId);
      data = result.state;
      showMessage(`Switched to ${inputId} (Job: ${result.jobId})`);
    } catch (error) {
      console.error('set input', error);
      if (error && typeof error === 'object' && 'status' in error && error.status === 409) {
        showMessage('Device busy - please wait for current operation to complete');
      } else {
        const msg = error instanceof Error ? error.message : 'Input control failed';
        showMessage(msg);
      }
    } finally {
      busy = false;
      broadcastRefresh();
    }
  };

  const handleVolume = async (value: number) => {
    if (!data) return;
    try {
      const result = await setVideoVolume(value);
      data = result.state;
    } catch (error) {
      console.error('set volume', error);
      if (error && typeof error === 'object' && 'status' in error && error.status === 409) {
        showMessage('Device busy - please wait for current operation to complete');
      } else {
        showMessage('Unable to set volume');
      }
    }
  };

  const handleMute = async () => {
    if (!data) return;
    const muted = !data.muted;
    try {
      const result = await setVideoMute(muted);
      data = result.state;
      showMessage(`${muted ? 'Muted' : 'Unmuted'} output (Job: ${result.jobId})`);
    } catch (error) {
      console.error('set mute', error);
      if (error && typeof error === 'object' && 'status' in error && error.status === 409) {
        showMessage('Device busy - please wait for current operation to complete');
      } else {
        showMessage('Unable to toggle mute');
      }
    }
  };

  const refreshRecordings = async () => {
    try {
      timeline = await fetchRecordingTimeline();
      if ((timeline ?? []).length && !selectedSegmentId) {
        selectedSegmentId = timeline[0].id;
      }
    } catch (error) {
      console.error('fetch recordings', error);
      showMessage('Unable to load recording timeline');
    }
  };

  const handleSyncVideo = async (filename: string) => {
    if (syncBusy[filename]) return;
    syncBusy[filename] = true;
    try {
      await syncVideo(filename);
      showMessage(`Synced ${filename} to device`);
      await refreshLibrary();
    } catch (error) {
      console.error('sync video', error);
      showMessage(error instanceof Error ? error.message : 'Unable to sync video');
    } finally {
      syncBusy[filename] = false;
    }
  };

  const handlePlayVideo = async (filename: string, synced: boolean) => {
    if (!data || busy) return;

    // If not synced, sync first
    if (!synced) {
      showMessage(`Syncing ${filename} to device...`);
      try {
        await handleSyncVideo(filename);
      } catch (error) {
        showMessage('Sync failed, cannot play video');
        return;
      }
    }

    busy = true;
    try {
      const response = await fetch('/ui/video/devices/pi-video-01/library/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to play video' }));
        showMessage(error.message || 'Failed to play video');
        return;
      }

      const result = await response.json();
      showMessage(`Playing ${filename} (Job: ${result.jobId})`);
    } catch (error) {
      console.error('play video', error);
      showMessage('Unable to play video');
    } finally {
      busy = false;
      broadcastRefresh();
    }
  };

  const openLivePreview = async () => {
    if (!data || liveLoading) return;
    liveLoading = true;
    try {
      if (USE_MOCKS) {
        const current = mockApi.video().livePreview;
        liveUrl = current?.streamUrl ?? null;
      } else {
        liveUrl = await generateLivePreviewUrl();
      }
      showMessage('Live preview ready');
    } catch (error) {
      console.error('preview error', error);
      showMessage(error instanceof Error ? error.message : 'Unable to start preview');
    } finally {
      liveLoading = false;
    }
  };

  const playSegment = (segment: VideoRecordingSegment) => {
    liveUrl = segment.url;
    selectedSegmentId = segment.id;
    segmentPosition = 0;
    showMessage(`Playing recording ${segment.label ?? segment.id}`);
  };

  const handleSegmentScrub = (value: number) => {
    segmentPosition = Math.max(0, Math.min(segmentDuration, Math.round(value)));
  };

  const loadLatest = async () => {
    try {
      data = await getVideoOverview();
      timeline = data.recordings;
      selectedSegmentId = timeline[0]?.id ?? null;
      showMessage('Video state refreshed');
    } catch (error) {
      console.error('refresh video', error);
      showMessage('Unable to refresh video state');
    } finally {
      broadcastRefresh();
    }
  };

  const refreshLibrary = async () => {
    try {
      library = await fetchVideoLibrary();
    } catch (error) {
      console.error('fetch library', error);
      showMessage('Unable to load video library');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  $: if (data?.livePreview && !liveUrl) {
    liveUrl = data.livePreview.streamUrl;
  }

  onMount(() => {
    if (browser) {
      refreshLibrary();
    }
  });
</script>

<Card {title} subtitle={variant === 'compact' ? 'Live display health' : 'Display orchestration'}>
  {#if state === 'loading'}
    <div class="stack">
      <Skeleton variant="block" height="9rem" />
      <Skeleton variant="line" />
    </div>
  {:else if state === 'error'}
    <div class="error-state" role="alert">
      <p>Video controller offline. Attempt to reconnect?</p>
      <Button variant="primary" on:click={loadLatest}>Retry</Button>
    </div>
  {:else if !data}
    <EmptyState
      title="No video telemetry"
      description="Bring a display online to configure playback."
    >
      <svelte:fragment slot="icon">📺</svelte:fragment>
      <svelte:fragment slot="action">
        <Button variant="secondary" on:click={loadLatest}>Refresh</Button>
      </svelte:fragment>
    </EmptyState>
  {:else if variant === 'compact'}
    <div class="compact">
      <div class="preview-thumb">
        <img
          src={data.livePreview?.thumbnailUrl ??
            'https://dummyimage.com/320x180/1d2b46/ffffff&text=Video'}
          alt="Video preview"
        />
        <StatusPill status={statusToPill(data)} />
      </div>
      <div class="compact-meta">
        <span class="label">Input</span>
        <strong>{data.input}</strong>
        <span class="label">Last signal</span>
        <strong>{data.lastSignal ? new Date(data.lastSignal).toLocaleTimeString() : '—'}</strong>
        <Button variant="ghost" on:click={openVideoControls}>Open controls</Button>
      </div>
    </div>
  {:else}
    <div class="video-layout">
      {#if statusMessage}
        <div class="banner" role="status">{statusMessage}</div>
      {/if}

      <section class="telemetry">
        <header>
          <h2>Telemetry</h2>
        </header>
        <div class="telemetry-grid">
          <div class="telemetry-item">
            <span class="label">Last Signal</span>
            <strong>{data.lastSignal ? new Date(data.lastSignal).toLocaleString() : 'No signal data'}</strong>
          </div>
          <div class="telemetry-item">
            <span class="label">Power State</span>
            <strong class={`power-${data.power}`}>{data.power}</strong>
          </div>
          <div class="telemetry-item">
            <span class="label">Current Input</span>
            <strong>{data.input}</strong>
          </div>
          <div class="telemetry-item">
            <span class="label">Command Feedback</span>
            <strong>{statusMessage ?? 'No recent commands'}</strong>
          </div>
        </div>
      </section>

      {#if isFeatureEnabled('video')}
        <section class="controls">
          <header>
            <h2>Display controls</h2>
          </header>
          <div class="controls-grid">
            <div class="power">
              <Button
                variant={data.power === 'on' ? 'primary' : 'secondary'}
                disabled={busy}
                on:click={() => handlePower('on')}
              >
                Power on
              </Button>
              <Button
                variant={data.power === 'off' ? 'primary' : 'secondary'}
                disabled={busy}
                on:click={() => handlePower('off')}
              >
                Power off
              </Button>
            </div>
            <div class="inputs" role="radiogroup" aria-label="Video input">
              {#each (data.availableInputs ?? []).filter(input => input.kind !== 'cast') as input (input.id)}
                <Button
                  variant={input.id === data.input ? 'primary' : 'ghost'}
                  disabled={busy}
                  on:click={() => handleInput(input.id)}
                  aria-pressed={input.id === data.input}
                >
                  {input.label}
                </Button>
              {/each}
            </div>
            <Slider
              label="Output volume"
              min={0}
              max={100}
              value={data.volume}
              unit="%"
              on:change={(event) => handleVolume(event.detail)}
            />
            <Button variant={data.muted ? 'primary' : 'ghost'} on:click={handleMute}>
              {data.muted ? 'Unmute' : 'Mute'}
            </Button>
          </div>
        </section>
      {/if}

      <section class="library">
        <header>
          <h2>Video library</h2>
        </header>
        {#if !library.length}
          <p class="muted">No videos in library. Add videos using the file manager to get started.</p>
        {:else}
          <ul class="library-list">
            {#each library as video (video.filename)}
              <li>
                <div class="video-info">
                  <span class="sync-indicator" class:synced={video.synced} title={video.synced ? 'Synced to device' : 'Not synced to device'}>●</span>
                  <div>
                    <strong>🎬 {video.filename}</strong>
                    <span class="muted">{formatFileSize(video.size)}</span>
                  </div>
                </div>
                <div class="video-actions">
                  {#if !video.synced}
                    <Button variant="ghost" size="sm" disabled={syncBusy[video.filename]} onclick={() => handleSyncVideo(video.filename)}>
                      {syncBusy[video.filename] ? 'Syncing…' : '⬇ Sync'}
                    </Button>
                  {/if}
                  <Button variant="primary" size="sm" disabled={syncBusy[video.filename]} onclick={() => handlePlayVideo(video.filename, video.synced)}>
                    ▶ Play
                  </Button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  {/if}
</Card>

<style>
  .stack {
    display: grid;
    gap: var(--spacing-3);
  }

  .error-state {
    display: grid;
    gap: var(--spacing-3);
  }

  .compact {
    display: flex;
    gap: var(--spacing-4);
    align-items: center;
  }

  .preview-thumb {
    position: relative;
    width: 12rem;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .preview-thumb img {
    display: block;
    width: 100%;
  }

  .preview-thumb :global(.status-pill) {
    position: absolute;
    top: var(--spacing-2);
    right: var(--spacing-2);
  }

  .compact-meta {
    display: grid;
    gap: 0.4rem;
  }

  .label {
    display: block;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .video-layout {
    display: grid;
    gap: var(--spacing-4);
  }

  .banner {
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid rgba(34, 197, 94, 0.4);
    background: rgba(34, 197, 94, 0.15);
    font-size: var(--font-size-sm);
  }

  .live header,
  .controls header,
  .timeline header,
  .cec header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .live-body {
    display: grid;
    gap: var(--spacing-3);
  }

  video,
  .live-body img {
    width: 100%;
    border-radius: var(--radius-lg);
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(2, 6, 23, 0.8);
  }

  .live-meta {
    display: flex;
    gap: var(--spacing-4);
    flex-wrap: wrap;
  }

  .controls-grid {
    display: grid;
    gap: var(--spacing-3);
  }

  .power {
    display: flex;
    gap: var(--spacing-2);
  }

  .inputs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .telemetry header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .telemetry-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: var(--spacing-3);
  }

  .telemetry-item {
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    background: rgba(12, 21, 41, 0.55);
  }

  .telemetry-item .label {
    display: block;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
  }

  .telemetry-item strong {
    display: block;
    font-size: var(--font-size-base);
  }

  .power-on {
    color: rgb(34, 197, 94);
  }

  .power-off {
    color: rgba(148, 163, 184, 0.9);
  }

  .timeline-body {
    display: grid;
    gap: var(--spacing-3);
    grid-template-columns: minmax(16rem, 1fr) minmax(0, 1.2fr);
  }

  .segments {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-md);
    max-height: 16rem;
    overflow-y: auto;
  }

  .segments li {
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .segments li:last-child {
    border-bottom: none;
  }

  .segments li button {
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    color: inherit;
    padding: var(--spacing-3);
    display: grid;
    gap: 0.35rem;
    cursor: pointer;
  }

  .segments li.selected button,
  .segments li button:hover {
    background: rgba(56, 189, 248, 0.12);
  }

  .scrubber {
    display: grid;
    gap: var(--spacing-2);
    padding: var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-md);
    background: rgba(12, 21, 41, 0.55);
  }

  .scrubber-header {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-sm);
  }

  .cec-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-2);
  }

  .cec-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    background: rgba(12, 21, 41, 0.55);
  }

  .cec-list .status {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .library-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-2);
  }

  .library-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    background: rgba(12, 21, 41, 0.55);
  }

  .video-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    flex: 1;
  }

  .video-info > div {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
    flex: 1;
  }

  .video-info strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sync-indicator {
    font-size: 1.2rem;
    line-height: 1;
    color: rgb(239, 68, 68);
    flex-shrink: 0;
  }

  .sync-indicator.synced {
    color: rgb(34, 197, 94);
  }

  .video-actions {
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
  }

  .muted {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  @media (max-width: 960px) {
    .timeline-body {
      grid-template-columns: 1fr;
    }
  }
</style>
