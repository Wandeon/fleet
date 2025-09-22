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

  let cameraGroup: Group | undefined;
  let loading = true;
  let error: string | null = null;
  let lastJobId: string | null = null;

  onMount(async () => {
    try {
      const [layout, state] = await Promise.all([
        getFleetLayout(),
        getFleetState(),
      ]);

      // Find the camera group
      cameraGroup = layout.groups?.find((g: Group) => g.kind === 'camera');

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
    if (!cameraGroup) return;

    try {
      const result = await postGroup('exterior-cams', action, body);
      if (result.job_id) {
        lastJobId = result.job_id;
      }
    } catch (err) {
      console.error(`Failed to execute ${action}:`, err);
    }
  }

  async function handleProbe() {
    await executeGroupCommand('probe');
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
    if (state.streaming !== undefined) parts.push(`Streaming: ${state.streaming ? 'Yes' : 'No'}`);
    if (state.resolution !== undefined) parts.push(`Resolution: ${state.resolution}`);
    if (state.fps !== undefined) parts.push(`FPS: ${state.fps}`);
    if (state.bitrate_kbps !== undefined) parts.push(`Bitrate: ${state.bitrate_kbps} kbps`);
    if (state.latency_ms !== undefined) parts.push(`Latency: ${state.latency_ms}ms`);

    return parts.length > 0 ? parts.join(', ') : 'Idle';
  }

  async function refreshDeviceStatus(deviceId: string) {
    try {
      await getKindStatus('camera', deviceId);
    } catch (err) {
      console.error('Failed to refresh device status:', err);
    }
  }

  function formatTimestamp(ts: string) {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleString();
  }
</script>

<div class="space-y-6">
  <header class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Camera Control</h1>
      <p class="text-sm text-neutral-500">Monitor and control exterior cameras</p>
    </div>
    <div class="text-sm text-neutral-500">
      Status: {getJobStatus()}
    </div>
  </header>

  {#if loading}
    <div class="border rounded-lg bg-white p-4 shadow-sm">Loading...</div>
  {:else if error}
    <div class="border border-rose-200 bg-rose-50 text-rose-700 rounded-lg p-4 shadow-sm">{error}</div>
  {:else if !cameraGroup}
    <div class="border rounded-lg bg-white p-4 shadow-sm text-neutral-600">
      No camera group found. Check device configuration.
    </div>
  {:else}
    <!-- Device Status -->
    <div class="bg-white border rounded-lg p-4 shadow-sm">
      <h2 class="text-lg font-semibold mb-3">Camera Devices</h2>
      <div class="grid gap-4 lg:grid-cols-2">
        {#each cameraGroup.devices as device}
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

              {#if $deviceStates[device.id]?.last_frame}
                <div class="text-neutral-500">
                  Last frame: {formatTimestamp($deviceStates[device.id]?.last_frame?.timestamp)}
                </div>
              {/if}

              {#if $deviceStates[device.id]?.frame}
                <div class="mt-3">
                  <p class="text-xs text-neutral-500 mb-2">Latest Capture:</p>
                  <img
                    src="data:image/jpeg;base64,{$deviceStates[device.id].frame}"
                    alt="Camera feed from {device.name}"
                    class="w-full max-w-xs rounded border"
                  />
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
      <h2 class="text-lg font-semibold mb-4">Group Controls</h2>

      <!-- Probe Control -->
      <div class="mb-4">
        <h3 class="font-medium mb-3">Capture Operations</h3>
        <div class="flex gap-3">
          <button
            class="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            data-testid="camera.probe"
            on:click={handleProbe}
          >
            Capture All Cameras
          </button>
        </div>
        <p class="text-sm text-neutral-500 mt-2">
          Captures a frame from all cameras and updates the status display
        </p>
      </div>
    </div>

    <!-- Help -->
    <div class="bg-neutral-50 border rounded-lg p-4 text-sm">
      <h3 class="font-medium mb-2">Usage Notes</h3>
      <ul class="space-y-1 text-neutral-600">
        <li>• Capture operations are sent to all cameras in the group</li>
        <li>• Latest frames appear automatically when available</li>
        <li>• Camera status updates in real-time via live stream</li>
        <li>• Use "Refresh Status" for manual diagnostics</li>
      </ul>
    </div>
  {/if}
</div>