<script lang="ts">
  import { deviceStates } from '$lib/stores/deviceStates';
  import { postGroup } from '$lib/api';

  export let videoGroup: any;

  let selectedInput = 'hdmi1';
  const inputOptions = ['hdmi1', 'hdmi2', 'chromecast'];

  async function executeVideoCommand(action: string, body?: any) {
    try {
      await postGroup('all-displays', action, body);
    } catch (err) {
      console.error(`Failed to execute ${action}:`, err);
    }
  }

  async function handlePowerOn() {
    await executeVideoCommand('power_on');
  }

  async function handlePowerOff() {
    await executeVideoCommand('power_off');
  }

  async function handleInputChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedInput = select.value;
    await executeVideoCommand('input', { source: selectedInput });
  }

  function getVideoState() {
    if (!videoGroup?.devices?.length) return null;
    return $deviceStates[videoGroup.devices[0].id];
  }

  function formatLastCommand(timestamp: string) {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  }

  $: videoState = getVideoState();
  $: isPoweredOn = videoState?.power === 'on';
  $: currentInput = videoState?.input || 'unknown';
  $: lastCommand = videoState?.last_command;
</script>

<!-- Power Control -->
<div class="mb-6">
  <h4 class="font-medium mb-3">Power Control</h4>
  <div class="flex gap-3">
    <button
      class="salon-btn {isPoweredOn ? 'salon-btn-success' : 'salon-btn-secondary'} salon-btn-large"
      on:click={handlePowerOn}
      disabled={isPoweredOn}
    >
      Power On
    </button>
    <button
      class="salon-btn {!isPoweredOn ? 'salon-btn-danger' : 'salon-btn-secondary'} salon-btn-large"
      on:click={handlePowerOff}
      disabled={!isPoweredOn}
    >
      Power Off
    </button>
  </div>
</div>

<!-- Input Selection -->
<div class="mb-6">
  <h4 class="font-medium mb-3">Input Selection</h4>
  <div class="flex items-center gap-3">
    <label class="font-medium">Current: {currentInput.toUpperCase()}</label>
    <select
      bind:value={selectedInput}
      class="salon-input salon-select"
      on:change={handleInputChange}
      disabled={!isPoweredOn}
    >
      {#each inputOptions as option}
        <option value={option}>{option.toUpperCase()}</option>
      {/each}
    </select>
  </div>
</div>

<!-- Status Information -->
<div class="salon-card-compact">
  <h4 class="font-medium mb-3">Status</h4>
  <div class="space-y-2">
    <div class="flex justify-between text-sm">
      <span>Power State:</span>
      <span class="font-medium {isPoweredOn ? 'text-green-600' : 'text-gray-500'}">
        {isPoweredOn ? 'ON' : 'OFF'}
      </span>
    </div>
    <div class="flex justify-between text-sm">
      <span>Active Input:</span>
      <span class="font-medium">{currentInput.toUpperCase()}</span>
    </div>
    <div class="flex justify-between text-sm">
      <span>Resolution:</span>
      <span class="font-medium">{videoState?.resolution || 'Unknown'}</span>
    </div>
    <div class="flex justify-between text-sm">
      <span>Last Command:</span>
      <span class="text-xs opacity-60">{formatLastCommand(lastCommand)}</span>
    </div>
  </div>
</div>

<!-- Device Grid -->
{#if videoGroup?.devices?.length > 0}
  <div class="mt-4">
    <h4 class="font-medium mb-3">Devices</h4>
    <div class="grid grid-cols-1 gap-2">
      {#each videoGroup.devices as device}
        {@const deviceState = $deviceStates[device.id]}
        <div class="salon-card-compact">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">{device.name}</div>
              <div class="text-xs opacity-60">
                {deviceState?.power || 'Unknown'} • {deviceState?.input || 'Unknown'}
              </div>
            </div>
            <span class="status-dot {deviceState?.status === 'online' ? 'ready' : 'offline'}"></span>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .text-green-600 {
    color: var(--ready);
  }

  .text-gray-500 {
    color: var(--neutral-500);
  }

  .space-y-2 > * + * {
    margin-top: var(--space-2);
  }

  .grid {
    display: grid;
  }

  .grid-cols-1 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  .gap-2 {
    gap: var(--space-2);
  }
</style>