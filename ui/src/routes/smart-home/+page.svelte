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

  let zigbeeGroup: Group | undefined;
  let loading = true;
  let error: string | null = null;
  let lastJobId: string | null = null;
  let permitJoinSeconds = 60;

  onMount(async () => {
    try {
      const [layout, state] = await Promise.all([
        getFleetLayout(),
        getFleetState(),
      ]);

      // Find the zigbee group
      zigbeeGroup = layout.groups?.find((g: Group) => g.kind === 'zigbee');

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

  async function executeGroupCommand(action: string, body?: any) {
    if (!zigbeeGroup) return;

    try {
      const result = await postGroup('zigbee-hubs', action, body);
      if (result.job_id) {
        lastJobId = result.job_id;
      }
    } catch (err) {
      console.error(`Failed to execute ${action}:`, err);
    }
  }

  async function handlePermitJoin() {
    await executeGroupCommand('permit_join', { seconds: permitJoinSeconds });
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
    if (state.coordinator !== undefined) parts.push(`Coordinator: ${state.coordinator}`);
    if (state.devices !== undefined) parts.push(`Devices: ${state.devices}`);
    if (state.permit_join !== undefined) parts.push(`Permit Join: ${state.permit_join ? 'Active' : 'Inactive'}`);
    if (state.network_channel !== undefined) parts.push(`Channel: ${state.network_channel}`);
    if (state.pan_id !== undefined) parts.push(`PAN ID: ${state.pan_id}`);

    return parts.length > 0 ? parts.join(', ') : 'Idle';
  }

  function formatPermitJoinUntil(deviceId: string) {
    const state = $deviceStates[deviceId];
    if (!state?.permit_join_until) return null;

    const until = new Date(state.permit_join_until);
    const now = new Date();
    const remaining = Math.max(0, Math.floor((until.getTime() - now.getTime()) / 1000));

    if (remaining <= 0) return 'Expired';

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
  }

  async function refreshDeviceStatus(deviceId: string) {
    try {
      await getKindStatus('zigbee', deviceId);
    } catch (err) {
      console.error('Failed to refresh device status:', err);
    }
  }
</script>

<div class="space-y-6">
  <header class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Smart Home Control</h1>
      <p class="text-sm text-neutral-500">Manage Zigbee coordinators and smart devices</p>
    </div>
    <div class="text-sm text-neutral-500">
      Status: {getJobStatus()}
    </div>
  </header>

  {#if loading}
    <div class="border rounded-lg bg-white p-4 shadow-sm">Loading...</div>
  {:else if error}
    <div class="border border-rose-200 bg-rose-50 text-rose-700 rounded-lg p-4 shadow-sm">{error}</div>
  {:else if !zigbeeGroup}
    <div class="border rounded-lg bg-white p-4 shadow-sm text-neutral-600">
      No Zigbee group found. Check device configuration.
    </div>
  {:else}
    <!-- Coordinator Status -->
    <div class="bg-white border rounded-lg p-4 shadow-sm">
      <h2 class="text-lg font-semibold mb-3">Zigbee Coordinators</h2>
      <div class="grid gap-4 lg:grid-cols-2">
        {#each zigbeeGroup.devices as device}
          <div class="border rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-medium">{device.name}</h3>
              <span class={`px-2 py-1 text-xs rounded-full ${
                getDeviceStatus(device.id) === 'online' ? 'bg-emerald-100 text-emerald-700' :
                getDeviceStatus(device.id) === 'offline' ? 'bg-rose-100 text-rose-700' :
                'bg-neutral-100 text-neutral-600'
              }`}>
                {getDeviceStatus(device.id)}
              </span>
            </div>

            <div class="space-y-2 text-sm">
              <p class="text-neutral-600">{formatDeviceState(device.id)}</p>

              <!-- Permit Join Status -->
              {#if $deviceStates[device.id]?.permit_join}
                <div class="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-700">
                  <div class="flex items-center justify-between">
                    <span class="font-medium">Permit Join Active</span>
                    <span class="text-xs">{formatPermitJoinUntil(device.id) || 'Active'}</span>
                  </div>
                </div>
              {/if}

              <!-- Network Info -->
              {#if $deviceStates[device.id]?.network_channel || $deviceStates[device.id]?.pan_id}
                <div class="p-2 bg-neutral-50 border rounded text-neutral-600 text-xs">
                  Network Details
                  {#if $deviceStates[device.id]?.network_channel}
                    • Channel: {$deviceStates[device.id].network_channel}
                  {/if}
                  {#if $deviceStates[device.id]?.pan_id}
                    • PAN ID: {$deviceStates[device.id].pan_id}
                  {/if}
                </div>
              {/if}
            </div>

            <div class="mt-4 flex gap-2">
              <button
                class="text-xs px-3 py-1 border rounded hover:bg-neutral-50"
                on:click={() => refreshDeviceStatus(device.id)}
              >
                Refresh Status
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Control Panel -->
    <div class="bg-white border rounded-lg p-4 shadow-sm">
      <h2 class="text-lg font-semibold mb-4">Network Operations</h2>

      <!-- Permit Join Control -->
      <div class="mb-6">
        <h3 class="font-medium mb-3">Device Pairing</h3>
        <div class="flex items-center gap-3 mb-3">
          <label class="font-medium">Duration:</label>
          <select bind:value={permitJoinSeconds} class="px-3 py-2 border rounded">
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
            <option value={120}>2 minutes</option>
            <option value={300}>5 minutes</option>
          </select>
          <button
            class="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium"
            data-testid="zigbee.permit_join"
            on:click={handlePermitJoin}
          >
            Enable Device Pairing
          </button>
        </div>
        <p class="text-sm text-neutral-500">
          Allows new Zigbee devices to join the network for the specified duration
        </p>
      </div>

      <!-- Network Stats -->
      <div>
        <h3 class="font-medium mb-3">Network Overview</h3>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {#each zigbeeGroup.devices as device}
            {@const state = $deviceStates[device.id]}
            <div class="p-3 border rounded-lg">
              <div class="text-2xl font-bold text-emerald-600">{state?.devices || '0'}</div>
              <div class="text-sm text-neutral-500">{device.name}</div>
              <div class="text-xs text-neutral-400">Connected Devices</div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Help -->
    <div class="bg-neutral-50 border rounded-lg p-4 text-sm">
      <h3 class="font-medium mb-2">Usage Notes</h3>
      <ul class="space-y-1 text-neutral-600">
        <li>• Use "Enable Device Pairing" to allow new Zigbee devices to join</li>
        <li>• Put your smart device into pairing mode while permit join is active</li>
        <li>• Device counts update automatically when new devices join</li>
        <li>• Coordinator status reflects the health of your Zigbee network</li>
      </ul>
    </div>
  {/if}
</div>