<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import { createEventDispatcher } from 'svelte';
  import type { PanelState } from '$lib/stores/app';
  import type { CameraEvent, CameraState, DeviceStatus } from '$lib/types';
  import {
    acknowledgeCameraEvent,
    getCameraOverview,
    refreshCameraPreview,
    requestCameraClip,
    selectCamera,
  } from '$lib/api/camera-operations';

  export let data: CameraState | null = null;
  export let state: PanelState = 'success';
  export let onRetry: (() => void) | undefined;
  export let title = 'Cameras';

  const dispatch = createEventDispatcher();

  let working = false;
  let selectedCamera = data?.activeCameraId ?? null;
  let previewUrl: string | null = data?.overview?.streamUrl ?? null;
  let snapshotUrl: string | null = data?.overview?.previewImage ?? null;
  let clipError: string | null = null;

  $: devices = data?.devices ?? [];
  $: events = data?.events ?? [];
  $: clips = data?.clips ?? [];
  $: activeDevice = devices.find((device) => device.id === selectedCamera) ?? devices[0] ?? null;

  const healthStatus = (value: DeviceStatus | undefined) => {
    if (value === 'online') return 'ok';
    if (value === 'error') return 'error';
    return 'warn';
  };

  const reload = async () => {
    if (!browser) return;
    working = true;
    try {
      const latest = await getCameraOverview({ fetch });
      data = latest;
      selectedCamera = latest.activeCameraId ?? latest.devices[0]?.id ?? null;
      previewUrl = latest.overview?.streamUrl ?? null;
      snapshotUrl = latest.overview?.previewImage ?? null;
      clipError = null;
      dispatch('updated', latest);
    } catch (error) {
      console.error('Failed to refresh camera overview', error);
    } finally {
      working = false;
    }
  };

  const handleSelect = async (cameraId: string) => {
    if (!browser || working || selectedCamera === cameraId) return;
    working = true;
    try {
      const next = await selectCamera(cameraId, { fetch });
      data = next;
      selectedCamera = next.activeCameraId;
      previewUrl = next.overview?.streamUrl ?? null;
      snapshotUrl = next.overview?.previewImage ?? null;
      clipError = null;
    } catch (error) {
      console.error('Failed to select camera', error);
    } finally {
      working = false;
    }
  };

  const handleAcknowledge = async (event: CameraEvent) => {
    if (!browser || working) return;
    working = true;
    try {
      const next = await acknowledgeCameraEvent(event.id, { fetch });
      data = next;
    } catch (error) {
      console.error('Failed to acknowledge camera event', error);
    } finally {
      working = false;
    }
  };

  const handleRefreshPreview = async () => {
    if (!browser || working) return;
    working = true;
    try {
      const next = await refreshCameraPreview(selectedCamera ?? undefined, { fetch });
      data = next;
      previewUrl = next.overview?.streamUrl ?? null;
      snapshotUrl = next.overview?.previewImage ?? null;
    } catch (error) {
      console.error('Failed to refresh preview', error);
    } finally {
      working = false;
    }
  };

  const handleRequestClip = async (event: CameraEvent) => {
    if (!browser) return;
    working = true;
    clipError = null;
    try {
      const clipUrl = await requestCameraClip(event, { fetch });
      window.open(clipUrl, '_blank', 'noopener');
    } catch (error) {
      clipError = error instanceof Error ? error.message : 'Unable to fetch clip';
    } finally {
      working = false;
    }
  };

  onMount(() => {
    selectedCamera = data?.activeCameraId ?? data?.devices[0]?.id ?? null;
    previewUrl = data?.overview?.streamUrl ?? null;
    snapshotUrl = data?.overview?.previewImage ?? null;
  });
</script>

<Card {title} subtitle="Live feeds, motion events, and recordings">
  {#if state === 'loading'}
    <div class="loading">
      <Skeleton variant="block" height="14rem" />
      <Skeleton variant="line" />
      <Skeleton variant="line" />
      <Skeleton variant="line" />
    </div>
  {:else if state === 'error'}
    <div class="error" role="alert">
      <p>Camera service unreachable. Check bridge connectivity.</p>
      <Button
        variant="primary"
        on:click={() => {
          dispatch('retry');
          onRetry?.();
        }}>Retry</Button
      >
    </div>
  {:else if !data}
    <EmptyState
      title="No camera data"
      description="Connect a camera bridge to view live previews."
    />
  {:else}
    <div class="layout">
      <aside class="devices">
        <h3>Cameras</h3>
        <ul>
          {#each devices as device (device.id)}
            <li>
              <button
                class:selected={device.id === selectedCamera}
                aria-pressed={device.id === selectedCamera}
                data-selected={device.id === selectedCamera ? 'true' : 'false'}
                on:click={() => handleSelect(device.id)}
                disabled={working && device.id !== selectedCamera}
              >
                <span class="name">{device.name}</span>
                <StatusPill status={healthStatus(device.status)} label={device.status} />
                <span class="location">{device.location ?? 'Unassigned'}</span>
              </button>
            </li>
          {/each}
        </ul>
      </aside>

      <section class="preview">
        <div class="preview-header">
          <div>
            <h3>Live preview</h3>
            <p>{activeDevice?.name ?? 'Select a camera'}</p>
          </div>
          <div class="preview-actions">
            <Button variant="ghost" on:click={handleRefreshPreview} disabled={working}
              >Refresh preview</Button
            >
            {#if previewUrl}
              <Button
                variant="secondary"
                on:click={() => window.open(previewUrl!, '_blank', 'noopener')}>Open stream</Button
              >
            {/if}
          </div>
        </div>
        <div class="preview-frame">
          {#if previewUrl}
            <video src={previewUrl} autoplay muted loop playsinline controls></video>
          {:else if snapshotUrl}
            <img src={snapshotUrl} alt="Camera snapshot" />
          {:else}
            <div class="preview-placeholder">No preview available</div>
          {/if}
        </div>
        {#if clipError}
          <p class="clip-error" role="alert">{clipError}</p>
        {/if}

        <div class="clips">
          <h4>Recent recordings</h4>
          {#if !clips.length}
            <p class="muted">No recordings captured for this camera yet.</p>
          {:else}
            <ul>
              {#each clips as clip (clip.id)}
                <li>
                  <button on:click={() => window.open(clip.url, '_blank', 'noopener')}>
                    <img
                      src={clip.thumbnailUrl ?? snapshotUrl ?? ''}
                      alt={clip.label ?? 'Recording thumbnail'}
                    />
                    <div>
                      <strong>{clip.label ?? 'Recording'}</strong>
                      <span
                        >{new Date(clip.start).toLocaleTimeString()} → {new Date(
                          clip.end
                        ).toLocaleTimeString()}</span
                      >
                    </div>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </section>

      <section class="events">
        <div class="events-header">
          <h3>Events</h3>
          <Button variant="ghost" on:click={reload} disabled={working}>Refresh</Button>
        </div>
        {#if !events.length}
          <EmptyState
            title="No recent detections"
            description="Motion and detections will appear here in real time."
          >
            <svelte:fragment slot="icon">🎥</svelte:fragment>
          </EmptyState>
        {:else}
          <ul>
            {#each events as event (event.id)}
              <li
                class:acknowledged={event.acknowledged}
                class:selected={event.cameraId === selectedCamera}
              >
                <div class="event-meta">
                  <time datetime={event.timestamp}
                    >{new Date(event.timestamp).toLocaleString()}</time
                  >
                  <StatusPill
                    status={event.severity === 'alert' || event.severity === 'error'
                      ? 'error'
                      : event.severity === 'warning'
                        ? 'warn'
                        : 'ok'}
                    label={event.severity}
                  />
                  <span class="tags">{event.tags?.join(', ')}</span>
                </div>
                <p class="event-description">{event.description}</p>
                <div class="event-actions">
                  <Button
                    variant="ghost"
                    on:click={() => handleRequestClip(event)}
                    disabled={working}>Open clip</Button
                  >
                  {#if !event.acknowledged}
                    <Button
                      variant="secondary"
                      on:click={() => handleAcknowledge(event)}
                      disabled={working}>Acknowledge</Button
                    >
                  {/if}
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
  .loading {
    display: grid;
    gap: var(--spacing-3);
  }

  .error {
    display: grid;
    gap: var(--spacing-3);
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    padding: var(--spacing-4);
    border-radius: var(--radius-md);
  }

  .layout {
    display: grid;
    grid-template-columns: 16rem minmax(0, 2fr) minmax(0, 1.6fr);
    gap: var(--spacing-4);
  }

  .devices {
    border-right: 1px solid rgba(148, 163, 184, 0.1);
    padding-right: var(--spacing-4);
  }

  .devices h3 {
    margin: 0 0 var(--spacing-3);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .devices ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-2);
  }

  .devices button {
    width: 100%;
    text-align: left;
    display: grid;
    gap: 0.3rem;
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.35);
    color: var(--color-text);
    cursor: pointer;
  }

  .devices button.selected {
    border-color: var(--color-brand);
    background: rgba(59, 130, 246, 0.15);
  }

  .devices .name {
    font-weight: 600;
  }

  .devices .location {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .preview {
    display: grid;
    gap: var(--spacing-4);
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .preview-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .preview-frame {
    border-radius: var(--radius-lg);
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.6);
    overflow: hidden;
    aspect-ratio: 16 / 9;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  video,
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .preview-placeholder {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .clip-error {
    margin: 0;
    color: var(--color-red-300);
    font-size: var(--font-size-sm);
  }

  .clips {
    display: grid;
    gap: var(--spacing-3);
  }

  .clips ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--spacing-3);
  }

  .clips li button {
    display: flex;
    gap: var(--spacing-3);
    align-items: center;
    width: 100%;
    background: rgba(15, 23, 42, 0.45);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    cursor: pointer;
    text-align: left;
  }

  .clips li img {
    width: 4.5rem;
    height: 3rem;
    object-fit: cover;
    border-radius: var(--radius-sm);
  }

  .clips li span {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .muted {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .events {
    display: grid;
    gap: var(--spacing-3);
  }

  .events-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .events ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-3);
  }

  .events li {
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    background: rgba(11, 23, 45, 0.35);
    display: grid;
    gap: var(--spacing-2);
  }

  .events li.selected {
    border-color: var(--color-brand);
  }

  .events li.acknowledged {
    opacity: 0.75;
  }

  .event-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-3);
    align-items: center;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .event-description {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }

  .event-actions {
    display: flex;
    gap: var(--spacing-3);
    flex-wrap: wrap;
  }

  @media (max-width: 1200px) {
    .layout {
      grid-template-columns: minmax(14rem, 1fr) minmax(0, 2fr);
      grid-template-rows: auto auto;
    }
    .events {
      grid-column: span 2;
    }
  }

  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }
    .devices {
      border-right: none;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
      padding-bottom: var(--spacing-4);
    }
    .preview-actions {
      flex-wrap: wrap;
      justify-content: flex-end;
    }
  }
</style>
