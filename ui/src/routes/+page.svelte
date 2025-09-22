<script lang="ts">
  import { onMount } from 'svelte';
  import { deviceStates } from '$lib/stores/deviceStates';
  import { getFleetLayout, getFleetState, getHealth } from '$lib/api';

  type Group = {
    id: string;
    name: string;
    kind: string;
    devices: any[];
  };

  let groups: Group[] = [];
  let loading = true;
  let error: string | null = null;
  let healthStatus: any = null;

  onMount(async () => {
    try {
      const [layout, state, health] = await Promise.all([
        getFleetLayout(),
        getFleetState(),
        getHealth().catch(() => ({ status: 'unknown' }))
      ]);

      groups = layout.groups || [];
      healthStatus = health;

      // Set initial device states
      if (state.states) {
        const stateMap = Object.fromEntries(
          state.states.map((s: any) => [s.deviceId, s.state])
        );
        deviceStates.set(stateMap);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  function getGroupHealth(group: Group) {
    if (!group.devices?.length) return 'unknown';

    const deviceStatuses = group.devices.map(device => {
      const state = $deviceStates[device.id];
      return state?.status || 'unknown';
    });

    if (deviceStatuses.every(status => status === 'online')) return 'online';
    if (deviceStatuses.some(status => status === 'online')) return 'degraded';
    return 'offline';
  }

  function getHealthBadgeClass(status: string) {
    const classes = {
      online: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      degraded: 'bg-amber-100 text-amber-700 border-amber-200',
      offline: 'bg-rose-100 text-rose-700 border-rose-200',
      unknown: 'bg-neutral-100 text-neutral-600 border-neutral-200'
    };
    return `px-2 py-1 text-xs rounded-full border ${classes[status] || classes.unknown}`;
  }

  function getGroupRoute(kind: string) {
    const routes = {
      audio: '/audio',
      video: '/video',
      camera: '/cameras',
      zigbee: '/smart-home'
    };
    return routes[kind] || '#';
  }
</script>

<div class="space-y-6">
  <header>
    <h1 class="text-2xl font-semibold mb-2">Fleet Dashboard</h1>
    <p class="text-neutral-600">Monitor and control your fleet devices by group</p>
  </header>

  {#if loading}
    <div class="border rounded-lg bg-white p-4 shadow-sm">Loading...</div>
  {:else if error}
    <div class="border border-rose-200 bg-rose-50 text-rose-700 rounded-lg p-4 shadow-sm">{error}</div>
  {:else}
    <!-- System Health -->
    {#if healthStatus}
      <div class="bg-white border rounded-lg p-4 shadow-sm">
        <h2 class="text-lg font-semibold mb-3">System Health</h2>
        <div class="flex items-center gap-3">
          <span class={getHealthBadgeClass(healthStatus.status || 'unknown')}>
            API: {healthStatus.status || 'unknown'}
          </span>
          {#if healthStatus.uptime}
            <span class="text-sm text-neutral-500">Uptime: {Math.round(healthStatus.uptime / 1000)}s</span>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Group Overview -->
    <div class="bg-white border rounded-lg p-4 shadow-sm">
      <h2 class="text-lg font-semibold mb-4">Device Groups</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {#each groups as group}
          <a
            href={getGroupRoute(group.kind)}
            class="block p-4 border rounded-lg hover:bg-neutral-50 transition-colors"
          >
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-medium">{group.name}</h3>
              <span class={getHealthBadgeClass(getGroupHealth(group))}>
                {getGroupHealth(group)}
              </span>
            </div>
            <div class="text-sm text-neutral-600">
              {group.devices?.length || 0} devices
            </div>
            <div class="text-xs text-neutral-500 mt-1 capitalize">
              {group.kind} group
            </div>
          </a>
        {/each}
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bg-white border rounded-lg p-4 shadow-sm">
      <h2 class="text-lg font-semibold mb-4">Quick Actions</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <a href="/audio" class="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
          <div class="font-medium text-emerald-700">Audio Control</div>
          <div class="text-sm text-emerald-600">Playback & Library</div>
        </a>
        <a href="/video" class="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
          <div class="font-medium text-blue-700">Video Control</div>
          <div class="text-sm text-blue-600">Display Management</div>
        </a>
        <a href="/cameras" class="px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
          <div class="font-medium text-purple-700">Camera Control</div>
          <div class="text-sm text-purple-600">Monitoring & Capture</div>
        </a>
        <a href="/smart-home" class="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
          <div class="font-medium text-amber-700">Smart Home</div>
          <div class="text-sm text-amber-600">Zigbee Network</div>
        </a>
      </div>
    </div>

    <!-- Usage Guide -->
    <div class="bg-neutral-50 border rounded-lg p-4 text-sm">
      <h3 class="font-medium mb-2">Getting Started</h3>
      <ul class="space-y-1 text-neutral-600">
        <li>• Use the navigation above to access each device category</li>
        <li>• All controls operate on groups of devices simultaneously</li>
        <li>• Device status updates automatically via live stream</li>
        <li>• Check the green/red indicator next to "Fleet Dashboard" for connection status</li>
      </ul>
    </div>
  {/if}
</div>

