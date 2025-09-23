<script lang="ts">
  import CameraModule from '$lib/modules/CameraModule.svelte';
  import { createModuleStateStore, type PanelState } from '$lib/stores/app';
  import { invalidate } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  const cameraStateStore = createModuleStateStore('camera');
  $: panelState = deriveState($cameraStateStore, data.error);

  function deriveState(base: PanelState, error: string | null): PanelState {
    if (error && base === 'success') return 'error';
    return base;
  }

  const refresh = () => invalidate('app:camera');
</script>

<CameraModule data={data.camera} state={panelState} onRetry={refresh} />
