<script lang="ts">
  import { onMount } from 'svelte';
  import { deviceStates, jobs } from '$lib/stores/deviceStates';
  import { getFleetLayout, getFleetState, postGroup, getKindStatus } from '$lib/api';

  type Device = {
    id: string;
    name: string;
    kind: string;
  };

  type Group = {
    id: string;
    name: string;
    kind: string;
    devices: Device[];
  };

  let videoGroup: Group | undefined;
  let loading = true;
  let error: string | null = null;
  let selectedInput = 'hdmi1';
  let lastJobId: string | null = null;

  const inputOptions = ['hdmi1', 'hdmi2', 'chromecast'];

  onMount(async () => {
    try {
      const [layout, state] = await Promise.all([
        getFleetLayout(),
        getFleetState(),
      ]);

      // Find the video group
      videoGroup = layout.groups?.find((g: Group) => g.kind === 'video');

      // Set initial device states
      if (state.states) {
        // Handle both array and object formats for states
        const statesArray = Array.isArray(state.states) ? state.states : Object.values(state.states || {});
        const stateMap = Object.fromEntries(
          statesArray.map((s: any) => [s.deviceId, s.state])
        );
        deviceStates.set(stateMap);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  async function executeGroupCommand(action: string, body?: any) {
    if (!videoGroup) return;

    try {
      const result = await postGroup('all-displays', action, body);
      if (result.job_id) {
        lastJobId = result.job_id;
      }
    } catch (err) {
      console.error(`Failed to execute ${action}:`, err);
    }
  }

  async function handlePowerOn() {
    await executeGroupCommand('power_on');
  }

  async function handlePowerOff() {
    await executeGroupCommand('power_off');
  }

  async function handleInputChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedInput = select.value;
    await executeGroupCommand('input', { source: selectedInput });
  }

  function getJobStatus() {
    if (!lastJobId) return 'Ready';
    const job = $jobs[lastJobId];
    if (!job) return 'Processing...';
    if (job.status === 'failed') return `Failed: ${job.error || 'Unknown error'}`;
    if (job.status === 'succeeded') return 'Completed';
    return job.status.charAt(0).toUpperCase() + job.status.slice(1);
  }

  function getDeviceStatus(deviceId: string) {
    const state = $deviceStates[deviceId];
    return state?.status || 'unknown';
  }

  function formatDeviceState(deviceId: string) {
    const state = $deviceStates[deviceId];
    if (!state) return 'No data';

    const parts = [];
    if (state.power !== undefined) parts.push(`Power: ${state.power}`);
    if (state.input !== undefined) parts.push(`Input: ${state.input}`);
    if (state.resolution !== undefined) parts.push(`Resolution: ${state.resolution}`);

    return parts.length > 0 ? parts.join(', ') : 'Idle';
  }

  async function refreshDeviceStatus(deviceId: string) {
    try {
      await getKindStatus('video', deviceId);
    } catch (err) {
      console.error('Failed to refresh device status:', err);
    }
  }
</script>

<div class="space-y-6">
  <header class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Video Control</h1>
      <p class="text-sm text-neutral-500">Control all display devices as a group</p>
    </div>
    <div class="text-sm text-neutral-500">
      Status: {getJobStatus()}
    </div>
  </header>

  {#if loading}
    <div class="border rounded-lg bg-white p-4 shadow-sm">Loading...</div>
  {:else if error}
    <div class="border border-rose-200 bg-rose-50 text-rose-700 rounded-lg p-4 shadow-sm">{error}</div>
  {:else if !videoGroup}
    <div class="border rounded-lg bg-white p-4 shadow-sm text-neutral-600">
      No video group found. Check device configuration.
    </div>
  {:else}
    <!-- Device Status -->
    <div class="bg-white border rounded-lg p-4 shadow-sm">
      <h2 class="text-lg font-semibold mb-3">Display Devices</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each videoGroup.devices as device}
          <div class="border rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-medium">{device.name}</h3>
              <span class={`px-2 py-1 text-xs rounded-full ${
                getDeviceStatus(device.id) === 'online' ? 'bg-emerald-100 text-emerald-700' :
                getDeviceStatus(device.id) === 'offline' ? 'bg-rose-100 text-rose-700' :
                'bg-neutral-100 text-neutral-600'
              }`}>
                {getDeviceStatus(device.id)}
              </span>
            </div>
            <p class="text-sm text-neutral-600 mb-2">{formatDeviceState(device.id)}</p>
            <button
              class="text-xs px-2 py-1 border rounded hover:bg-neutral-50"
              on:click={() => refreshDeviceStatus(device.id)}
            >
              Refresh
            </button>
          </div>
        {/each}
      </div>
    </div>

    <!-- Control Panel -->
    <div class="bg-white border rounded-lg p-4 shadow-sm">
      <h2 class="text-lg font-semibold mb-4">Group Controls</h2>

      <!-- Power Controls -->
      <div class="mb-6">
        <h3 class="font-medium mb-3">Power Management</h3>
        <div class="flex gap-3">
          <button
            class="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium"
            data-testid="video.power_on"
            on:click={handlePowerOn}
          >
            Power On All Displays
          </button>
          <button
            class="px-6 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 font-medium"
            data-testid="video.power_off"
            on:click={handlePowerOff}
          >
            Power Off All Displays
          </button>
        </div>
      </div>

      <!-- Input Selection -->
      <div>
        <h3 class="font-medium mb-3">Input Selection</h3>
        <div class="flex items-center gap-3">
          <label class="font-medium">Switch all displays to:</label>
          <select
            bind:value={selectedInput}
            class="px-3 py-2 border rounded-lg"
            data-testid="video.input.select"
            on:change={handleInputChange}
          >
            {#each inputOptions as option}
              <option value={option}>{option.toUpperCase()}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    <!-- Help -->
    <div class="bg-neutral-50 border rounded-lg p-4 text-sm">
      <h3 class="font-medium mb-2">Usage Notes</h3>
      <ul class="space-y-1 text-neutral-600">
        <li>• Commands are sent to all devices in the video group simultaneously</li>
        <li>• Device status updates automatically via live stream</li>
        <li>• Individual device diagnostics available by clicking "Refresh"</li>
        <li>• Power and input changes may take a few seconds to complete</li>
      </ul>
    </div>
  {/if}
</div>