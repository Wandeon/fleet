<script lang="ts">
  import AudioModule from '$lib/modules/AudioModule.svelte';
  import { createModuleStateStore, type PanelState } from '$lib/stores/app';
  import { invalidate } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  const audioStateStore = createModuleStateStore('audio');
  $: panelState = deriveState($audioStateStore, data.error);

  function deriveState(base: PanelState, error: string | null): PanelState {
    if (error && base === 'success') return 'error';
    return base;
  }

  const refresh = () => invalidate('app:audio');
</script>

<AudioModule data={data.audio} state={panelState} onRetry={refresh} />

{#if data.error && panelState !== 'error'}
  <p class="error-note" role="alert">{data.error}</p>
{/if}

<style>
  .error-note {
    margin-top: var(--spacing-3);
    color: var(--color-warning);
  }
</style>
