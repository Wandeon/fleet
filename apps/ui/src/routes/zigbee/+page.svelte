<script lang="ts">
  import ZigbeeModule from '$lib/modules/ZigbeeModule.svelte';
  import { createModuleStateStore, type PanelState } from '$lib/stores/app';
  import { invalidate } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  const zigbeeStateStore = createModuleStateStore('zigbee');
  $: panelState = deriveState($zigbeeStateStore, data.error);

  function deriveState(base: PanelState, error: string | null): PanelState {
    if (error && base === 'success') return 'error';
    return base;
  }

  const refresh = () => invalidate('app:zigbee');
</script>

<ZigbeeModule data={data.zigbee} state={panelState} onRetry={refresh} />
