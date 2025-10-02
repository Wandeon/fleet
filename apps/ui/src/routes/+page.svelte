<script lang="ts">
  import AudioModule from '$lib/modules/AudioModule.svelte';
  import VideoModule from '$lib/modules/VideoModule.svelte';
  import ZigbeeModule from '$lib/modules/ZigbeeModule.svelte';
  import CameraModule from '$lib/modules/CameraModule.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import { createModuleStateStore, type PanelState } from '$lib/stores/app';
  import { invalidate } from '$app/navigation';
  import { featureFlags } from '$lib/config/features';
  import type { PageData } from './$types';

  export let data: PageData;

  const audioStateStore = createModuleStateStore('audio');
  const videoStateStore = createModuleStateStore('video');
  const zigbeeStateStore = createModuleStateStore('zigbee');
  const cameraStateStore = createModuleStateStore('camera');

  $: audioPanelState = deriveState($audioStateStore, data.audio.error);
  $: videoPanelState = deriveState($videoStateStore, data.video.error);
  $: zigbeePanelState = deriveState($zigbeeStateStore, data.zigbee.error);
  $: cameraPanelState = deriveState($cameraStateStore, data.camera.error);

  $: fleetState = data.fleetState?.data;
  $: fleetError = data.fleetState?.error;
  $: connectionStatus = fleetState?.connection?.status ?? 'offline';
  $: totalDevices = fleetState?.audio?.total ?? 0;
  $: onlineDevices = fleetState?.audio?.online ?? 0;
  $: healthEvents = data.healthEvents?.data?.events ?? [];
  $: recentErrors = healthEvents.filter((e: any) => e.severity === 'error').slice(0, 3);

  function deriveState(base: PanelState, hasError: string | null): PanelState {
    if (hasError && base === 'success') return 'error';
    return base;
  }

  const refreshDashboard = () => invalidate('app:dashboard');
</script>

{#if fleetState}
  <div class="status-banner">
    <div class="status-item">
      <span class="label">Connection</span>
      <StatusPill
        status={connectionStatus === 'online' ? 'ok' : connectionStatus === 'degraded' ? 'warn' : 'error'}
        label={connectionStatus}
      />
    </div>
    <div class="status-item">
      <span class="label">Devices</span>
      <span class="value">{onlineDevices}/{totalDevices} online</span>
    </div>
    {#if fleetState.build}
      <div class="status-item">
        <span class="label">Version</span>
        <span class="value">{fleetState.build.version}</span>
      </div>
    {/if}
  </div>
{:else if fleetError}
  <div class="status-banner error">
    <span class="label">Fleet status unavailable:</span>
    <span class="value">{fleetError}</span>
  </div>
{/if}

{#if recentErrors.length > 0}
  <div class="errors-banner">
    <div class="errors-header">
      <span class="errors-title">Recent Errors</span>
      <span class="errors-count">{recentErrors.length}</span>
    </div>
    <div class="errors-list">
      {#each recentErrors as error}
        <div class="error-item">
          <span class="error-time">{new Date(error.timestamp).toLocaleTimeString()}</span>
          <span class="error-message">{error.message}</span>
          {#if error.target}
            <span class="error-target">({error.target})</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<div class="modules">
  <AudioModule
    data={data.audio.data}
    state={audioPanelState}
    variant="compact"
    onRetry={refreshDashboard}
  />
  {#if featureFlags.video}
    <VideoModule data={data.video.data} state={videoPanelState} onRetry={refreshDashboard} />
  {/if}
  {#if featureFlags.zigbee}
    <ZigbeeModule data={data.zigbee.data} state={zigbeePanelState} onRetry={refreshDashboard} />
  {/if}
  {#if featureFlags.camera}
    <CameraModule data={data.camera.data} state={cameraPanelState} onRetry={refreshDashboard} />
  {/if}
</div>

<style>
  .status-banner {
    display: flex;
    gap: var(--spacing-4);
    padding: var(--spacing-3) var(--spacing-4);
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: var(--radius-md);
    align-items: center;
    flex-wrap: wrap;
  }

  .status-banner.error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .label {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .value {
    font-size: var(--font-size-sm);
    color: var(--color-text);
    font-weight: 500;
  }

  .modules {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .errors-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--radius-md);
    padding: var(--spacing-3) var(--spacing-4);
  }

  .errors-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-2);
  }

  .errors-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-red-300);
  }

  .errors-count {
    background: rgba(239, 68, 68, 0.2);
    color: var(--color-red-300);
    padding: 0 var(--spacing-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .errors-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .error-item {
    display: flex;
    gap: var(--spacing-2);
    align-items: baseline;
    font-size: var(--font-size-sm);
  }

  .error-time {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    white-space: nowrap;
  }

  .error-message {
    color: var(--color-text);
    flex: 1;
  }

  .error-target {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }
</style>
