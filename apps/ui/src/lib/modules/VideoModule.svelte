<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Slider from '$lib/components/Slider.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import { createEventDispatcher } from 'svelte';
  import { goto, invalidate } from '$app/navigation';
  import { resolve } from '$app/paths';
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
    uploadVideo,
    deleteVideo,
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
  let uploadBusy = false;

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

  const handleVideoUpload = () => {
    if (!browser || uploadBusy) {
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.addEventListener('change', async () => {
      const selected = input.files?.[0] ?? null;
      input.remove();
      if (!selected) return;

      if (selected.size > 500 * 1024 * 1024) {
        showMessage('File too large. Maximum size is 500 MB.');
        return;
      }

      uploadBusy = true;
      try {
        await uploadVideo(selected);
        await refreshLibrary();
        showMessage(`Uploaded ${selected.name} successfully`);
      } catch (error) {
        console.error('video upload error', error);
        showMessage(error instanceof Error ? error.message : 'Upload failed');
      } finally {
        uploadBusy = false;
      }
    });
    input.click();
  };

  const handleVideoDelete = async (filename: string) => {
    if (uploadBusy) return;

    if (!confirm(`Delete ${filename}?`)) {
      return;
    }

    uploadBusy = true;
    try {
      await deleteVideo(filename);
      await refreshLibrary();
      showMessage(`Deleted ${filename}`);
    } catch (error) {
      console.error('video delete error', error);
      showMessage(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      uploadBusy = false;
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
        <strong>{new Date(data.lastSignal).toLocaleTimeString()}</strong>
        <Button variant="ghost" on:click={openVideoControls}>Open controls</Button>
      </div>
    </div>
  {:else}
    <div class="video-layout">
      {#if statusMessage}
        <div class="banner" role="status">{statusMessage}</div>
      {/if}
      <section class="live">
        <header>
          <h2>Live preview</h2>
          <div class="actions">
            <Button variant="ghost" on:click={loadLatest}>Refresh state</Button>
            <Button variant="ghost" disabled={liveLoading} on:click={openLivePreview}>
              {liveLoading ? 'Preparing…' : 'Start live preview'}
            </Button>
          </div>
        </header>
        <div class="live-body">
          {#if liveUrl}
            <video
              controls
              autoplay
              muted
              playsinline
              poster={data.livePreview?.thumbnailUrl}
              src={liveUrl}
            ></video>
          {:else}
            <img
              src={data.livePreview?.thumbnailUrl ??
                'https://dummyimage.com/640x360/0f172a/ffffff&text=Preview'}
              alt="Video preview"
            />
          {/if}
          <div class="live-meta">
            <div>
              <span class="label">Input</span>
              <strong>{data.input}</strong>
            </div>
            <div>
              <span class="label">Latency</span>
              <strong>{data.livePreview ? `${data.livePreview.latencyMs} ms` : '—'}</strong>
            </div>
            <div>
              <span class="label">Signal</span>
              <strong>{new Date(data.lastSignal).toLocaleTimeString()}</strong>
            </div>
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
              {#each (data.availableInputs ?? []) as input (input.id)}
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

      <section class="timeline">
        <header>
          <h2>Recording timeline</h2>
          <div class="actions">
            <Button variant="ghost" on:click={refreshRecordings}>Refresh recordings</Button>
          </div>
        </header>
        {#if !timeline.length}
          <p class="muted">No recording history for the selected display.</p>
        {:else}
          <div class="timeline-body">
            <ul class="segments">
              {#each timeline as segment (segment.id)}
                <li class:selected={segment.id === selectedSegmentId}>
                  <button type="button" on:click={() => playSegment(segment)}>
                    <strong>{segment.label ?? segment.id}</strong>
                    <span
                      >{new Date(segment.start).toLocaleTimeString()} → {new Date(
                        segment.end
                      ).toLocaleTimeString()}</span
                    >
                  </button>
                </li>
              {/each}
            </ul>
            {#if selectedSegment}
              <div class="scrubber">
                <div class="scrubber-header">
                  <strong>{selectedSegment.label ?? selectedSegment.id}</strong>
                  <span>{segmentDuration ? `${segmentPosition}s / ${segmentDuration}s` : '—'}</span>
                </div>
                <Slider
                  label="Scrub recording"
                  min={0}
                  max={Math.max(segmentDuration, 1)}
                  value={segmentPosition}
                  step={1}
                  displayValue={false}
                  on:change={(event) => handleSegmentScrub(event.detail)}
                />
                <Button variant="ghost" on:click={() => playSegment(selectedSegment)}
                  >Play segment</Button
                >
              </div>
            {/if}
          </div>
        {/if}
      </section>

      <section class="cec">
        <header>
          <h2>CEC devices</h2>
        </header>
        {#if !(data.cecDevices ?? []).length}
          <p class="muted">No downstream CEC devices reported.</p>
        {:else}
          <ul class="cec-list">
            {#each (data.cecDevices ?? []) as device (device.id)}
              <li>
                <div>
                  <strong>{device.name}</strong>
                  <span class="muted">{device.id}</span>
                </div>
                <div class="status">
                  <StatusPill status={device.power === 'on' ? 'ok' : 'offline'} />
                  <span>{device.input ?? '—'}</span>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="library">
        <header>
          <h2>Video library</h2>
          <div class="actions">
            <Button variant="ghost" on:click={refreshLibrary}>Refresh library</Button>
            <Button variant="primary" disabled={uploadBusy} on:click={handleVideoUpload}>
              {uploadBusy ? 'Uploading…' : 'Upload video'}
            </Button>
          </div>
        </header>
        {#if !library.length}
          <p class="muted">No videos in library. Upload a video to get started.</p>
        {:else}
          <ul class="library-list">
            {#each library as video (video.filename)}
              <li>
                <div class="video-info">
                  <strong>{video.filename}</strong>
                  <span class="muted">{formatFileSize(video.size)}</span>
                </div>
                <Button
                  variant="ghost"
                  disabled={uploadBusy}
                  on:click={() => handleVideoDelete(video.filename)}
                >
                  Delete
                </Button>
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
    display: grid;
    gap: 0.25rem;
    min-width: 0;
  }

  .video-info strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
