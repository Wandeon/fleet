<script>
  import { onMount } from 'svelte';
  import GlobalStatusBar from '$lib/components/GlobalStatusBar.svelte';
  import DeviceCard from '$lib/components/DeviceCard.svelte';
  import LogConsole from '$lib/components/LogConsole.svelte';

  let health = null;
  let devices = [];

  async function loadData() {
    try {
      const [healthRes, deviceRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/devices')
      ]);
      health = await healthRes.json();
      devices = await deviceRes.json();
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  }

  onMount(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  });

  $: healthMap = health?.components ?? {};
</script>

<div class="space-y-4">
  <GlobalStatusBar {health} />

  {#if devices.length === 0}
    <div class="border rounded-lg p-4 bg-white text-sm text-neutral-600">No devices registered. Update <code>inventory/device-interfaces.yaml</code>.</div>
  {:else}
    <div class="grid gap-4 md:grid-cols-2">
      {#each devices as device}
        <DeviceCard {device} healthStatus={healthMap[device.id] ?? null} />
      {/each}
    </div>
  {/if}

  <LogConsole />
</div>

