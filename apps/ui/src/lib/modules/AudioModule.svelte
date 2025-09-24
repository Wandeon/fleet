<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Slider from '$lib/components/Slider.svelte';
  import DeviceTile from '$lib/components/DeviceTile.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import { useMocks } from '$lib/stores/app';
  import type { PanelState } from '$lib/stores/app';
  import type { AudioDevice, AudioState } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  export let data: AudioState | null = null;
  export let state: PanelState = 'success';
  export let variant: 'compact' | 'full' = 'full';
  export let title = 'Audio';
  export let onRetry: (() => void) | undefined;

  const dispatch = createEventDispatcher();
  $: usingMocks = $useMocks;

  let uploadProgress = 0;
  let isUploading = false;
  let uploadStatus = '';
  let showUploadModal = false;
  let fileInput: HTMLInputElement;

  function formatVolume(value: number) {
    return `${Math.round(value)}%`;
  }

  function retry() {
    dispatch('retry');
    onRetry?.();
  }

  function deviceStatus(device: AudioDevice) {
    if (device.status === 'error') return 'error';
    if (device.status === 'offline') return 'offline';
    return 'ok';
  }

  function openUploadDialog() {
    showUploadModal = true;
  }

  function closeUploadModal() {
    showUploadModal = false;
    uploadStatus = '';
    uploadProgress = 0;
  }

  function triggerFileInput() {
    fileInput.click();
  }

  async function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg'];
    if (!allowedTypes.includes(file.type)) {
      uploadStatus = 'Error: Please select an audio file (MP3, WAV, OGG)';
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      uploadStatus = 'Error: File too large (max 50MB)';
      return;
    }

    isUploading = true;
    uploadStatus = 'Uploading...';
    uploadProgress = 0;

    try {
      const formData = new FormData();
      formData.append('audio', file);

      // Simulate upload progress for now - in real implementation this would be actual upload
      const uploadInterval = setInterval(() => {
        uploadProgress += 10;
        if (uploadProgress >= 90) {
          clearInterval(uploadInterval);
        }
      }, 200);

      // Mock API call - replace with actual API endpoint
      await new Promise(resolve => setTimeout(resolve, 2000));

      clearInterval(uploadInterval);
      uploadProgress = 100;
      uploadStatus = 'Upload complete! File ready for playbook.';

      setTimeout(() => {
        isUploading = false;
        closeUploadModal();
        // Refresh audio data
        onRetry?.();
      }, 1500);

    } catch (error) {
      clearInterval(uploadInterval);
      isUploading = false;
      uploadStatus = `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
</script>

<Card title={title} subtitle="Dual Pi audio routing">
  {#if state === 'loading'}
    <div class="stack">
      <Skeleton variant="line" />
      <Skeleton variant="block" height="7rem" />
      <div class="device-skeletons">
        <Skeleton variant="block" height="6rem" />
        <Skeleton variant="block" height="6rem" />
      </div>
    </div>
  {:else if state === 'error'}
    <div class="error-state" role="alert">
      <p>Audio subsystem unreachable. pi-audio-02 didn’t respond. Retry?</p>
      <Button variant="primary" on:click={retry}>Retry</Button>
    </div>
  {:else if state === 'empty'}
    <EmptyState title="No audio devices discovered" description="Bring a Pi online to start playback.">
      <svelte:fragment slot="icon">🔈</svelte:fragment>
      <svelte:fragment slot="action">
        <Button variant="secondary" disabled={usingMocks}>Scan again</Button>
      </svelte:fragment>
    </EmptyState>
  {:else if data}
    <div class={`audio-grid ${variant}`}>
      <section class="controls">
        <div class="actions">
          <Button variant="primary">Play on both</Button>
          <Button variant="secondary">Pause</Button>
        </div>
        <Slider label="Master volume" min={0} max={200} value={data.masterVolume} unit="%" />
        {#if data.nowPlaying}
          <div class="now-playing">
            {#if data.nowPlaying.art}
              <img src={data.nowPlaying.art} alt="Album art" width="72" height="72" />
            {/if}
            <div>
              <span class="label">Now playing</span>
              <strong>{data.nowPlaying.track}</strong>
              <span class="artist">{data.nowPlaying.artist}</span>
            </div>
          </div>
        {:else}
          <p class="idle">Idle · Queue a track to begin.</p>
        {/if}
      </section>
      <section class="devices">
        {#each data.devices as device (device.id)}
          <DeviceTile title={device.name} subtitle={device.nowPlaying ?? 'Idle'} status={deviceStatus(device)}>
            <div class="device-actions">
              <Button variant="ghost" aria-label={`Previous track on ${device.name}`}>⏮</Button>
              <Button variant="ghost" aria-label={`Play or pause ${device.name}`} aria-pressed={device.isPlaying}>
                {device.isPlaying ? '⏸' : '▶️'}
              </Button>
              <Button variant="ghost" aria-label={`Next track on ${device.name}`}>⏭</Button>
            </div>
            <div class="device-volume">
              <Slider
                label="Volume"
                min={0}
                max={200}
                value={device.volume}
                unit="%"
                displayValue={true}
              />
              <span class="volume-value">{formatVolume(device.volume)}</span>
            </div>
            <svelte:fragment slot="actions">
              <time class="timestamp">Updated {new Date(device.lastUpdated).toLocaleTimeString()}</time>
            </svelte:fragment>
          </DeviceTile>
        {/each}
      </section>
      <section class="file-actions">
        <h3>File actions</h3>
        <div class="buttons">
          <Button disabled={usingMocks || isUploading} on:click={openUploadDialog}>
            {isUploading ? 'Uploading...' : 'Upload Audio'}
          </Button>
          <Button variant="secondary" disabled={usingMocks}>Replace fallback</Button>
        </div>
        {#if usingMocks}
          <p class="hint">Connect to the live API to enable file management.</p>
        {:else}
          <p class="hint">Upload audio files for playbook scheduling and fallback content.</p>
        {/if}
      </section>
    </div>
  {:else}
    <EmptyState title="Audio state unavailable" description="No data received from audio service." />
  {/if}
</Card>

<!-- Upload Modal -->
{#if showUploadModal}
  <div class="modal-overlay" on:click={closeUploadModal} role="dialog" aria-modal="true">
    <div class="modal-content" on:click|stopPropagation>
      <header class="modal-header">
        <h2>Upload Audio File</h2>
        <button class="close-button" on:click={closeUploadModal} aria-label="Close">✕</button>
      </header>

      <div class="modal-body">
        {#if !isUploading}
          <div class="upload-area">
            <div class="upload-icon">🎵</div>
            <p>Choose an audio file to upload</p>
            <p class="file-info">Supported formats: MP3, WAV, OGG (max 50MB)</p>
            <Button variant="primary" on:click={triggerFileInput}>Select File</Button>
          </div>
        {:else}
          <div class="upload-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {uploadProgress}%"></div>
            </div>
            <p class="upload-status">{uploadStatus}</p>
            <p class="progress-text">{uploadProgress}%</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Hidden file input -->
<input
  type="file"
  accept="audio/*"
  bind:this={fileInput}
  on:change={handleFileUpload}
  style="display: none"
>

<style>
  .stack {
    display: grid;
    gap: var(--spacing-3);
  }

  .device-skeletons {
    display: grid;
    gap: var(--spacing-3);
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  }

  .error-state {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .audio-grid {
    display: grid;
    gap: var(--spacing-4);
  }

  .audio-grid.compact .file-actions {
    display: none;
  }

  .controls {
    display: grid;
    gap: var(--spacing-3);
    align-items: center;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .now-playing {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--spacing-3);
    align-items: center;
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(12, 21, 41, 0.7);
  }

  .now-playing img {
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }

  .now-playing .label {
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    color: var(--color-text-muted);
    letter-spacing: 0.08em;
  }

  .now-playing strong {
    display: block;
    font-size: var(--font-size-lg);
  }

  .now-playing .artist {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .idle {
    margin: 0;
    color: var(--color-text-muted);
  }

  .devices {
    display: grid;
    gap: var(--spacing-3);
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  }

  .device-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .device-volume {
    display: grid;
    gap: 0.35rem;
  }

  .volume-value {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .timestamp {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .file-actions {
    display: grid;
    gap: var(--spacing-2);
  }

  .file-actions h3 {
    margin: 0;
    font-size: var(--font-size-md);
  }

  .file-actions .buttons {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }

  .hint {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    width: 90%;
    max-width: 28rem;
    max-height: 90vh;
    overflow: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-4);
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .modal-header h2 {
    margin: 0;
    font-size: var(--font-size-lg);
  }

  .close-button {
    background: none;
    border: none;
    font-size: var(--font-size-lg);
    cursor: pointer;
    color: var(--color-text-muted);
    padding: var(--spacing-1);
    border-radius: var(--radius-sm);
    transition: background 0.2s ease;
  }

  .close-button:hover {
    background: rgba(148, 163, 184, 0.1);
  }

  .modal-body {
    padding: var(--spacing-4);
  }

  .upload-area {
    text-align: center;
    padding: var(--spacing-6) var(--spacing-4);
    border: 2px dashed rgba(148, 163, 184, 0.3);
    border-radius: var(--radius-md);
    background: rgba(11, 23, 45, 0.2);
  }

  .upload-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-3);
  }

  .upload-area p {
    margin: var(--spacing-2) 0;
  }

  .file-info {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .upload-progress {
    text-align: center;
    padding: var(--spacing-4);
  }

  .progress-bar {
    width: 100%;
    height: 0.5rem;
    background: rgba(148, 163, 184, 0.2);
    border-radius: var(--radius-full);
    overflow: hidden;
    margin-bottom: var(--spacing-3);
  }

  .progress-fill {
    height: 100%;
    background: var(--color-brand);
    transition: width 0.3s ease;
    border-radius: var(--radius-full);
  }

  .upload-status {
    margin: var(--spacing-2) 0;
    font-weight: 500;
  }

  .progress-text {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }
</style>
