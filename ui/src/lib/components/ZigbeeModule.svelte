<script lang="ts">
  import { deviceStates } from '$lib/stores/deviceStates';
  import { postGroup } from '$lib/api';

  export let zigbeeGroup: any;

  let permitJoinSeconds = 60;
  let permitJoinActive = false;
  let countdown = 0;

  async function executeZigbeeCommand(action: string, body?: any) {
    try {
      await postGroup('zigbee-hubs', action, body);
    } catch (err) {
      console.error(`Failed to execute ${action}:`, err);
    }
  }

  async function handlePermitJoin() {
    permitJoinActive = true;
    countdown = permitJoinSeconds;
    await executeZigbeeCommand('permit_join', { seconds: permitJoinSeconds });

    // Start countdown
    const interval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        permitJoinActive = false;
        clearInterval(interval);
      }
    }, 1000);
  }

  function getZigbeeState() {
    if (!zigbeeGroup?.devices?.length) return null;
    return $deviceStates[zigbeeGroup.devices[0].id];
  }

  function formatPermitJoinTime(deviceId: string) {
    const state = $deviceStates[deviceId];
    if (!state?.permit_join_until) return null;

    const until = new Date(state.permit_join_until);
    const now = new Date();
    const remaining = Math.max(0, Math.floor((until.getTime() - now.getTime()) / 1000));

    if (remaining <= 0) return 'Expired';

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function getDeviceIcon(type: string) {
    const icons = {
      'light': '💡',
      'switch': '🔘',
      'sensor': '📡',
      'plug': '🔌',
      'coordinator': '🐝',
      'router': '📶'
    };
    return icons[type] || '📱';
  }

  $: zigbeeState = getZigbeeState();
  $: coordinatorOnline = zigbeeState?.status === 'online';
  $: deviceCount = zigbeeState?.devices || 0;
  $: networkChannel = zigbeeState?.network_channel;
  $: panId = zigbeeState?.pan_id;
</script>

<!-- Pairing Control -->
<div class="mb-6">
  <h4 class="font-medium mb-3">Device Pairing</h4>
  <div class="flex items-center gap-3 mb-3">
    <label class="font-medium">Duration:</label>
    <select bind:value={permitJoinSeconds} class="salon-input salon-select" disabled={permitJoinActive}>
      <option value={30}>30 seconds</option>
      <option value={60}>1 minute</option>
      <option value={120}>2 minutes</option>
      <option value={300}>5 minutes</option>
    </select>
    <button
      class="salon-btn {permitJoinActive ? 'salon-btn-secondary' : 'salon-btn-primary'} salon-btn-large"
      on:click={handlePermitJoin}
      disabled={permitJoinActive || !coordinatorOnline}
    >
      {#if permitJoinActive}
        Pairing Active ({countdown}s)
      {:else}
        Enable Pairing
      {/if}
    </button>
  </div>
  <p class="text-sm opacity-60">
    Put your Zigbee device in pairing mode, then click "Enable Pairing"
  </p>
</div>

<!-- Network Status -->
<div class="salon-card-compact mb-4">
  <h4 class="font-medium mb-3">Network Status</h4>
  <div class="space-y-2">
    <div class="flex justify-between text-sm">
      <span>Coordinator:</span>
      <span class="flex items-center gap-2">
        <span class="status-dot {coordinatorOnline ? 'ready' : 'offline'}"></span>
        {coordinatorOnline ? 'Online' : 'Offline'}
      </span>
    </div>
    <div class="flex justify-between text-sm">
      <span>Connected Devices:</span>
      <span class="font-medium">{deviceCount}</span>
    </div>
    {#if networkChannel}
      <div class="flex justify-between text-sm">
        <span>Channel:</span>
        <span class="font-medium">{networkChannel}</span>
      </div>
    {/if}
    {#if panId}
      <div class="flex justify-between text-sm">
        <span>PAN ID:</span>
        <span class="font-medium">{panId}</span>
      </div>
    {/if}
  </div>
</div>

<!-- Quick Scenes -->
<div class="mb-4">
  <h4 class="font-medium mb-3">Quick Scenes</h4>
  <div class="flex gap-2">
    <button class="salon-btn salon-btn-secondary">
      ✨ Ambient
    </button>
    <button class="salon-btn salon-btn-secondary">
      ☀️ Bright
    </button>
    <button class="salon-btn salon-btn-danger">
      🌙 All Off
    </button>
  </div>
</div>

<!-- Coordinator Status -->
{#if zigbeeGroup?.devices?.length > 0}
  <div>
    <h4 class="font-medium mb-3">Coordinators</h4>
    {#each zigbeeGroup.devices as device}
      {@const deviceState = $deviceStates[device.id]}
      {@const permitJoinTime = formatPermitJoinTime(device.id)}
      <div class="salon-card-compact mb-2">
        <div class="flex items-center justify-between mb-2">
          <div>
            <div class="text-sm font-medium">{device.name}</div>
            <div class="text-xs opacity-60">
              {deviceState?.devices || 0} devices connected
            </div>
          </div>
          <span class="status-dot {deviceState?.status === 'online' ? 'ready' : 'offline'}"></span>
        </div>

        {#if deviceState?.permit_join}
          <div class="mt-2 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            <div class="flex items-center justify-between">
              <span class="font-medium">🔗 Pairing Active</span>
              {#if permitJoinTime}
                <span class="text-xs">{permitJoinTime} remaining</span>
              {/if}
            </div>
          </div>
        {/if}

        {#if deviceState?.network_channel || deviceState?.pan_id}
          <div class="mt-2 text-xs opacity-60">
            Network:
            {#if deviceState.network_channel}Ch {deviceState.network_channel}{/if}
            {#if deviceState.pan_id} • PAN {deviceState.pan_id}{/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .space-y-2 > * + * {
    margin-top: var(--space-2);
  }

  .bg-green-50 {
    background-color: #f0fdf4;
  }

  .border-green-200 {
    border-color: #bbf7d0;
  }

  .text-green-700 {
    color: #15803d;
  }
</style>