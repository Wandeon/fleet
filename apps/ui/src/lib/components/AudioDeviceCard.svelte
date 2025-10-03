<script lang="ts">
  import Button from './Button.svelte';
  import Slider from './Slider.svelte';
  import StatusPill from './StatusPill.svelte';
  import type { AudioDeviceSnapshot } from '$lib/types';
  import {
    playDeviceSource,
    stopDevice,
    setDeviceVolume,
    getDeviceConfig,
    updateDeviceConfig,
    uploadDeviceFallback,
    type DeviceConfigPayload,
  } from '$lib/api/audio-device-control';
  import { createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';

  export let device: AudioDeviceSnapshot;

  const dispatch = createEventDispatcher<{ refresh: void; error: string; success: string }>();

  let loading = {
    playStream: false,
    playFile: false,
    stop: false,
    volume: false,
    config: false,
    upload: false,
  };

  let showConfigModal = false;
  let config: DeviceConfigPayload | null = null;
  let configForm = {
    stream_url: '',
    mode: 'auto' as 'auto' | 'manual',
    source: 'stream' as 'stream' | 'file' | 'stop',
  };

  const getStatusVariant = (status: string) => {
    if (status === 'online') return 'ok';
    if (status === 'offline') return 'offline';
    return 'error';
  };

  const handlePlayStream = async () => {
    loading.playStream = true;
    try {
      await playDeviceSource(device.id, 'stream');
      dispatch('success', `Playing stream on ${device.name}`);
      dispatch('refresh');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to play stream';
      dispatch('error', message);
    } finally {
      loading.playStream = false;
    }
  };

  const handlePlayFile = async () => {
    loading.playFile = true;
    try {
      await playDeviceSource(device.id, 'file');
      dispatch('success', `Playing fallback file on ${device.name}`);
      dispatch('refresh');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to play file';
      dispatch('error', message);
    } finally {
      loading.playFile = false;
    }
  };

  const handleStop = async () => {
    loading.stop = true;
    try {
      await stopDevice(device.id);
      dispatch('success', `Stopped ${device.name}`);
      dispatch('refresh');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop device';
      dispatch('error', message);
    } finally {
      loading.stop = false;
    }
  };

  const handleVolumeChange = async (event: CustomEvent<number>) => {
    const volumePercent = event.detail;
    const volume = volumePercent / 50; // Convert 0-100% to 0-2
    loading.volume = true;
    try {
      await setDeviceVolume(device.id, volume);
      dispatch('success', `Volume set to ${volumePercent}%`);
      dispatch('refresh');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set volume';
      dispatch('error', message);
    } finally {
      loading.volume = false;
    }
  };

  const openConfigModal = async () => {
    loading.config = true;
    try {
      config = await getDeviceConfig(device.id);
      configForm = {
        stream_url: config.stream_url ?? '',
        mode: config.mode ?? 'auto',
        source: config.source ?? 'stream',
      };
      showConfigModal = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load config';
      dispatch('error', message);
    } finally {
      loading.config = false;
    }
  };

  const handleConfigSubmit = async () => {
    loading.config = true;
    try {
      await updateDeviceConfig(device.id, {
        stream_url: configForm.stream_url || undefined,
        mode: configForm.mode,
        source: configForm.source,
      });
      dispatch('success', 'Configuration updated');
      showConfigModal = false;
      dispatch('refresh');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update config';
      dispatch('error', message);
    } finally {
      loading.config = false;
    }
  };

  const handleUpload = () => {
    if (!browser || loading.upload) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;

      // Validate size before upload
      if (file.size > 50 * 1024 * 1024) {
        dispatch('error', 'File too large. Maximum size is 50 MB.');
        return;
      }

      loading.upload = true;
      try {
        await uploadDeviceFallback(device.id, file);
        dispatch('success', 'Fallback uploaded successfully');
        dispatch('refresh');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        dispatch('error', message);
      } finally {
        loading.upload = false;
      }
    });

    input.click();
  };
</script>

<div class="device-card">
  <div class="device-header">
    <div class="device-info">
      <h3>{device.name}</h3>
      <span class="device-id">{device.id}</span>
    </div>
    <StatusPill status={getStatusVariant(device.status)} />
  </div>

  <div class="device-status">
    <div class="status-item">
      <span class="label">Source:</span>
      <span class="value">{device.playback?.state ?? 'idle'}</span>
    </div>
    <div class="status-item">
      <span class="label">Fallback:</span>
      <span class={`pill ${device.fallbackExists ? 'success' : 'warn'}`}>
        {device.fallbackExists ? 'Ready' : 'None'}
      </span>
    </div>
  </div>

  <div class="controls">
    <div class="button-group">
      <Button
        variant="primary"
        size="sm"
        disabled={device.status !== 'online' || loading.playStream}
        on:click={handlePlayStream}
      >
        {loading.playStream ? 'Playing...' : 'Play Stream'}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={device.status !== 'online' || loading.playFile || !device.fallbackExists}
        on:click={handlePlayFile}
        title={!device.fallbackExists ? 'No fallback file uploaded' : 'Play fallback file'}
      >
        {loading.playFile ? 'Playing...' : 'Play File'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={device.status !== 'online' || loading.stop}
        on:click={handleStop}
      >
        {loading.stop ? 'Stopping...' : 'Stop'}
      </Button>
    </div>

    <Slider
      label="Volume"
      min={0}
      max={100}
      value={device.volumePercent}
      unit="%"
      disabled={device.status !== 'online' || loading.volume}
      on:change={handleVolumeChange}
    />

    <div class="button-group">
      <Button
        variant="ghost"
        size="sm"
        disabled={device.status !== 'online' || loading.config}
        on:click={openConfigModal}
      >
        {loading.config ? 'Loading...' : 'Config'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={device.status !== 'online' || loading.upload}
        on:click={handleUpload}
      >
        {loading.upload ? 'Uploading...' : 'Upload Fallback'}
      </Button>
    </div>
  </div>
</div>

{#if showConfigModal}
  <div class="modal" role="dialog" aria-modal="true" aria-label="Configure {device.name}">
    <div class="modal-content">
      <header>
        <h3>Configure {device.name}</h3>
        <button type="button" on:click={() => (showConfigModal = false)} aria-label="Close">×</button>
      </header>
      <div class="modal-body">
        <label>
          <span>Stream URL</span>
          <input type="url" bind:value={configForm.stream_url} placeholder="https://stream.example.com/audio" />
        </label>
        <label>
          <span>Mode</span>
          <select bind:value={configForm.mode}>
            <option value="auto">Auto (fallback on stream failure)</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label>
          <span>Source</span>
          <select bind:value={configForm.source}>
            <option value="stream">Stream</option>
            <option value="file">File</option>
            <option value="stop">Stop</option>
          </select>
        </label>
      </div>
      <footer>
        <Button variant="ghost" on:click={() => (showConfigModal = false)}>Cancel</Button>
        <Button variant="primary" disabled={loading.config} on:click={handleConfigSubmit}>
          {loading.config ? 'Saving...' : 'Save'}
        </Button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .device-card {
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-md);
    padding: var(--spacing-4);
    background: rgba(12, 21, 41, 0.55);
    display: grid;
    gap: var(--spacing-3);
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: var(--spacing-3);
  }

  .device-info h3 {
    margin: 0;
    font-size: var(--font-size-lg);
  }

  .device-id {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .device-status {
    display: flex;
    gap: var(--spacing-3);
    flex-wrap: wrap;
    padding: var(--spacing-2) 0;
    border-top: 1px solid rgba(148, 163, 184, 0.1);
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .status-item {
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
    font-size: var(--font-size-sm);
  }

  .status-item .label {
    color: var(--color-text-muted);
  }

  .pill {
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .pill.success {
    background: rgba(34, 197, 94, 0.18);
    color: rgb(187, 247, 208);
  }

  .pill.warn {
    background: rgba(251, 191, 36, 0.18);
    color: rgb(253, 224, 71);
  }

  .controls {
    display: grid;
    gap: var(--spacing-3);
  }

  .button-group {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }

  .modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(2, 6, 23, 0.8);
    display: grid;
    place-items: center;
    padding: var(--spacing-6);
    z-index: 1000;
  }

  .modal-content {
    background: var(--color-bg-primary);
    border-radius: var(--radius-lg);
    border: 1px solid rgba(148, 163, 184, 0.2);
    width: min(32rem, 100%);
    display: grid;
    grid-template-rows: auto 1fr auto;
    max-height: 90vh;
  }

  .modal-content header,
  .modal-content footer {
    padding: var(--spacing-4);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-3);
  }

  .modal-content header button {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.2rem;
    cursor: pointer;
  }

  .modal-body {
    padding: var(--spacing-4);
    display: grid;
    gap: var(--spacing-3);
    overflow-y: auto;
  }

  .modal-body label {
    display: grid;
    gap: 0.5rem;
  }

  .modal-body input,
  .modal-body select {
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: var(--radius-sm);
    padding: 0.45rem 0.6rem;
    color: var(--color-text);
  }
</style>
