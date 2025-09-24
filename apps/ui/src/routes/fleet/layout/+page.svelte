<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';

  let fleetLayout: any = null;
  let error: string | null = null;
  let loading = true;

  onMount(async () => {
    try {
      const response = await api.get('/fleet/layout');
      fleetLayout = response;
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load fleet layout';
      console.error('Failed to load fleet layout:', err);
    } finally {
      loading = false;
    }
  });

  function retry() {
    loading = true;
    error = null;
    onMount();
  }
</script>

<svelte:head>
  <title>Fleet Layout</title>
</svelte:head>

<main class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-6">Fleet Layout</h1>

  {#if loading}
    <div class="flex items-center justify-center p-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <span class="ml-3">Loading fleet layout...</span>
    </div>
  {:else if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      <p>Error: {error}</p>
      <button
        on:click={retry}
        class="mt-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm"
      >
        Retry
      </button>
    </div>
  {:else if fleetLayout}
    <div class="space-y-6">
      <div class="text-sm text-gray-600 mb-4">
        Generated at: {new Date(fleetLayout.generatedAt).toLocaleString()}
      </div>

      {#if fleetLayout.modules && fleetLayout.modules.length > 0}
        <div class="grid gap-6">
          {#each fleetLayout.modules as module}
            <div class="bg-white rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold mb-4 capitalize">{module.module} Module</h2>
              {#if module.devices && module.devices.length > 0}
                <div class="space-y-3">
                  {#each module.devices as device}
                    <div class="border rounded p-4">
                      <div class="flex justify-between items-start mb-2">
                        <div>
                          <h3 class="font-medium">{device.name}</h3>
                          <p class="text-sm text-gray-500">{device.id}</p>
                        </div>
                        <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {device.role}
                        </span>
                      </div>
                      {#if device.capabilities && device.capabilities.length > 0}
                        <div class="flex flex-wrap gap-1 mt-2">
                          {#each device.capabilities as capability}
                            <span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                              {capability}
                            </span>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-gray-500">No devices configured in this module</p>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p>No modules discovered</p>
          <button
            on:click={retry}
            class="mt-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm"
          >
            Retry
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <p class="text-gray-500">No layout data available</p>
  {/if}
</main>