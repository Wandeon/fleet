<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import type { PanelState } from '$lib/stores/app';
  import type { CameraState } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  export let data: CameraState | null = null;
  export let state: PanelState = 'success';
  export let onRetry: (() => void) | undefined;
  export let title = 'Camera';

  const dispatch = createEventDispatcher();

  const statusCopy: Record<CameraState['summary']['status'], string> = {
    online: 'Online',
    offline: 'Offline',
    degraded: 'Degraded'
  };

  const severityClass: Record<'info' | 'warn' | 'error', string> = {
    info: 'info',
    warn: 'warn',
    error: 'error'
  };

  const statusPillClass: Record<'online' | 'offline' | 'degraded', string> = {
    online: 'online',
    offline: 'offline',
    degraded: 'degraded'
  };

  function retry() {
    dispatch('retry');
    onRetry?.();
  }

  const formatTimestamp = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const renderStatus = (status: 'online' | 'offline' | 'degraded'): string => statusCopy[status] ?? status;
</script>

<Card title={title} subtitle="Camera availability and recent activity">
  {#if state === 'loading'}
    <div class="stack">
      <Skeleton variant="block" height="10rem" />
      <Skeleton variant="line" />
      <Skeleton variant="line" />
    </div>
  {:else if state === 'error'}
    <div class="error-state" role="alert">
      <p>Camera bridge timed out. Verify MediaMTX and camera connectivity.</p>
      <Button variant="primary" on:click={retry}>Retry</Button>
    </div>
  {:else if state === 'empty'}
    <EmptyState title="No camera events yet" description="Connect a camera to get started.">
      <svelte:fragment slot="icon">🎥</svelte:fragment>
    </EmptyState>
  {:else if data}
    <div class="camera-grid">
      <div class="preview" aria-live="polite">
        {#if data.preview.status === 'ready' && data.preview.streamUrl}
          <video
            controls
            preload="metadata"
            poster={data.preview.posterUrl ?? undefined}
            src={data.preview.streamUrl}
          >
            <track kind="captions" srcLang="en" label="Captions unavailable" />
          </video>
        {:else}
          <div class="placeholder" role="status">
            <span class="icon" aria-hidden="true">🎥</span>
            <p>Preview unavailable</p>
            {#if data.preview.reason}
              <small>{data.preview.reason}</small>
            {:else}
              <small>MediaMTX integration pending.</small>
            {/if}
            <Button variant="secondary" on:click={retry}>Check again</Button>
          </div>
        {/if}
      </div>

      <div class="details">
        <div class={`summary-pill ${statusPillClass[data.summary.status]}`} role="status">
          <span class="dot" aria-hidden="true"></span>
          <div>
            <strong>{renderStatus(data.summary.status)}</strong>
            <span>Updated {formatTimestamp(data.summary.updatedAt)}</span>
          </div>
        </div>
        {#if data.summary.reason}
          <p class="reason">{data.summary.reason}</p>
        {/if}

        <div class="camera-list" aria-label="Registered cameras">
          {#each data.summary.cameras as camera (camera.id)}
            <div class="camera-item">
              <div>
                <strong>{camera.name}</strong>
                <small>{camera.id}</small>
              </div>
              <span class={`camera-status ${statusPillClass[camera.status]}`}>{renderStatus(camera.status)}</span>
            </div>
            {#if camera.reason}
              <p class="camera-reason">{camera.reason}</p>
            {/if}
          {/each}
        </div>

        <div class="events">
          <h3>Recent events</h3>
          {#if data.events.length === 0}
            <p class="no-events">No detections reported yet.</p>
          {:else}
            <ul>
              {#each data.events.slice(0, 5) as event (event.id)}
                <li class={`event ${severityClass[event.severity]}`}>
                  <div class="event-meta">
                    <strong>{event.message}</strong>
                    <time datetime={event.ts}>{formatTimestamp(event.ts)}</time>
                  </div>
                  {#if event.cameraId}
                    <span class="event-camera">{event.cameraId}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <EmptyState title="Camera data missing" description="No frames received from camera service." />
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

  .camera-grid {
    display: grid;
    gap: var(--spacing-4);
    grid-template-columns: minmax(16rem, 1.8fr) minmax(0, 1fr);
  }

  .preview {
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(11, 23, 45, 0.7);
    min-height: 12rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  video {
    width: 100%;
    height: auto;
    display: block;
    background: black;
  }

  .placeholder {
    display: grid;
    gap: var(--spacing-2);
    justify-items: center;
    padding: var(--spacing-4);
    text-align: center;
    color: var(--color-text-muted);
  }

  .placeholder .icon {
    font-size: 2rem;
  }

  .details {
    display: grid;
    gap: var(--spacing-4);
  }

  .summary-pill {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-3);
    border-radius: var(--radius-lg);
    background: rgba(148, 163, 184, 0.12);
    border: 1px solid rgba(148, 163, 184, 0.18);
  }

  .summary-pill .dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background: currentColor;
  }

  .summary-pill.online {
    color: rgb(134, 239, 172);
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.35);
  }

  .summary-pill.degraded {
    color: rgb(250, 204, 21);
    background: rgba(250, 204, 21, 0.1);
    border-color: rgba(250, 204, 21, 0.35);
  }

  .summary-pill.offline {
    color: rgb(248, 113, 113);
    background: rgba(248, 113, 113, 0.1);
    border-color: rgba(248, 113, 113, 0.35);
  }

  .summary-pill strong {
    display: block;
    font-size: var(--font-size-sm);
  }

  .summary-pill span {
    display: block;
    font-size: var(--font-size-xs);
    color: rgba(226, 232, 240, 0.75);
  }

  .reason {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .camera-list {
    display: grid;
    gap: var(--spacing-3);
  }

  .camera-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-3);
  }

  .camera-item strong {
    font-size: var(--font-size-sm);
  }

  .camera-item small {
    display: block;
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }

  .camera-status {
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: rgba(148, 163, 184, 0.14);
    color: var(--color-text-muted);
  }

  .camera-status.online {
    background: rgba(34, 197, 94, 0.14);
    color: rgb(134, 239, 172);
  }

  .camera-status.degraded {
    background: rgba(250, 204, 21, 0.14);
    color: rgb(250, 204, 21);
  }

  .camera-status.offline {
    background: rgba(248, 113, 113, 0.14);
    color: rgb(248, 113, 113);
  }

  .camera-reason {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .events {
    display: grid;
    gap: var(--spacing-3);
  }

  .events h3 {
    margin: 0;
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .events ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-2);
  }

  .event {
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid rgba(148, 163, 184, 0.12);
    background: rgba(11, 23, 45, 0.3);
    display: grid;
    gap: var(--spacing-2);
  }

  .event.info {
    border-color: rgba(96, 165, 250, 0.2);
  }

  .event.warn {
    border-color: rgba(250, 204, 21, 0.25);
  }

  .event.error {
    border-color: rgba(248, 113, 113, 0.25);
  }

  .event-meta {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-3);
    flex-wrap: wrap;
  }

  .event-meta strong {
    font-size: var(--font-size-sm);
  }

  .event-meta time {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .event-camera {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .no-events {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  @media (max-width: 900px) {
    .camera-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
