<script lang="ts">
  import VideoModule from '$lib/modules/VideoModule.svelte';
  import { createModuleStateStore, type PanelState } from '$lib/stores/app';
  import { invalidate } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  const videoStateStore = createModuleStateStore('video');
  $: panelState = deriveState($videoStateStore, data.error);

  function deriveState(base: PanelState, error: string | null): PanelState {
    if (error && base === 'success') return 'error';
    return base;
  }

  const refresh = () => invalidate('app:video');
</script>

<VideoModule data={data.video} state={panelState} onRetry={refresh} />
