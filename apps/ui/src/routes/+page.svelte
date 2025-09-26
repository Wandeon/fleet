<script lang="ts">
  import AudioModule from '$lib/modules/AudioModule.svelte';
  import VideoModule from '$lib/modules/VideoModule.svelte';
  import ZigbeeModule from '$lib/modules/ZigbeeModule.svelte';
  import CameraModule from '$lib/modules/CameraModule.svelte';
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

  function deriveState(base: PanelState, hasError: string | null): PanelState {
    if (hasError && base === 'success') return 'error';
    return base;
  }

  const refreshDashboard = () => invalidate('app:dashboard');
</script>

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
  .modules {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }
</style>
