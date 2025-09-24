<script lang="ts">
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  import { apiClient as api } from '$lib/api/client';


  let fleetState: any = null;
  let error: string | null = null;
  let loading = true;

  const loadState = async () => {
    try {
      const response = await api.fetchState();
      fleetState = response;
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load fleet state';
      console.error('Failed to load fleet state:', err);
    } finally {
      loading = false;
    }
  };

  onMount(loadState);

  async function retry() {
    loading = true;
    error = null;
    await loadState();
  }
</script>

<svelte:head>
  <title>Fleet Overview</title>
</svelte:head>

<main class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-6">Fleet Overview</h1>

  {#if loading}
    <div class="flex items-center justify-center p-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <span class="ml-3">Loading fleet state...</span>
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
  {:else if fleetState}
    <div class="space-y-6">
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold mb-4">Audio Devices</h2>
        <div class="flex items-center space-x-4 mb-4">
          <span class="text-sm text-gray-600">
            Total: {fleetState.audio?.total || 0}
          </span>
          <span class="text-sm text-gray-600">
            Online: {fleetState.audio?.online || 0}
          </span>
        </div>
        {#if fleetState.audio?.devices && fleetState.audio.devices.length > 0}
          <div class="space-y-2">
            {#each fleetState.audio.devices as device}
              <a
                href="/fleet/{device.id}"
                class="flex items-center justify-between p-3 border rounded hover:bg-gray-50 transition-colors"
              >
                <div>
                  <span class="font-medium">{device.name}</span>
                  <span class="text-sm text-gray-500 ml-2">({device.id})</span>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="text-sm text-gray-600">{device.role}</span>
                  <span class={`px-2 py-1 rounded text-xs ${
                    device.online
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {device.online ? 'Online' : 'Offline'}
                  </span>
                  <span class="text-gray-400">›</span>
                </div>
              </a>
            {/each}
          </div>
        {:else}
          <p class="text-gray-500">No audio devices discovered</p>
        {/if}
      </div>

      <div class="text-xs text-gray-500">
        Last updated: {new Date(fleetState.updatedAt).toLocaleString()}
      </div>
    </div>
  {:else}
    <p class="text-gray-500">No fleet data available</p>
  {/if}
</main>
