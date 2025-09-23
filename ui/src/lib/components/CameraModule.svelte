<script lang="ts">
  import { deviceStates } from '$lib/stores/deviceStates';
  import { postGroup } from '$lib/api';

  export let cameraGroup: any;

  let recording = false;
  let showPreview = true;
  let lastMotionEvents: Array<{timestamp: string, type: string}> = [];

  async function executeCameraCommand(action: string, body?: any) {
    try {
      await postGroup('exterior-cams', action, body);
    } catch (err) {
      console.error(`Failed to execute ${action}:`, err);
    }
  }

  async function handleCapture() {
    await executeCameraCommand('probe');
  }

  async function toggleRecording() {
    recording = !recording;
    await executeCameraCommand('record', { enabled: recording });
  }

  function getCameraState() {
    if (!cameraGroup?.devices?.length) return null;
    return $deviceStates[cameraGroup.devices[0].id];
  }

  function formatTimestamp(ts: string) {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleString();
  }

  function getLastMotionTime(deviceId: string) {
    const state = $deviceStates[deviceId];
    if (!state?.last_motion) return null;

    const lastMotion = new Date(state.last_motion);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastMotion.getTime()) / 60000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return lastMotion.toLocaleDateString();
  }

  $: cameraState = getCameraState();
  $: isOnline = cameraState?.status === 'online';
  $: latestFrame = cameraState?.frame;
  $: lastFrame = cameraState?.last_frame;
</script>

<!-- Live Preview -->
{#if showPreview}
  <div class="mb-6">
    <div class="flex items-center justify-between mb-3">
      <h4 class="font-medium">Live Preview</h4>
      <button
        class="salon-btn salon-btn-primary"
        on:click={handleCapture}
        disabled={!isOnline}
      >
        📸 Capture
      </button>
    </div>

    <div class="preview-container">
      {#if latestFrame}
        <img
          src="data:image/jpeg;base64,{latestFrame}"
          alt="Camera preview"
          class="preview-image"
        />
      {:else}
        <div class="preview-placeholder">
          <span class="text-4xl opacity-40">📷</span>
          <p class="text-sm opacity-60 mt-2">No preview available</p>
          {#if !isOnline}
            <p class="text-xs opacity-40">Camera offline</p>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Recording Control -->
<div class="mb-6">
  <h4 class="font-medium mb-3">Recording</h4>
  <div class="flex items-center gap-3">
    <button
      class="salon-btn {recording ? 'salon-btn-danger' : 'salon-btn-secondary'} salon-btn-large"
      on:click={toggleRecording}
      disabled={!isOnline}
    >
      {#if recording}
        🔴 Stop Recording
      {:else}
        ⚫ Start Recording
      {/if}
    </button>
    {#if recording}
      <span class="text-sm text-red-600 flex items-center gap-1">
        <span class="recording-dot"></span>
        Recording active
      </span>
    {/if}
  </div>
</div>

<!-- Recent Events -->
<div class="salon-card-compact mb-4">
  <h4 class="font-medium mb-3">Recent Activity</h4>

  {#if cameraGroup?.devices?.length > 0}
    {#each cameraGroup.devices as device}
      {@const deviceState = $deviceStates[device.id]}
      {@const lastMotion = getLastMotionTime(device.id)}
      <div class="event-item">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium">{device.name}</div>
            <div class="text-xs opacity-60">
              {#if lastMotion}
                Last motion: {lastMotion}
              {:else}
                No recent motion
              {/if}
            </div>
          </div>
          <span class="status-dot {deviceState?.status === 'online' ? 'ready' : 'offline'}"></span>
        </div>

        {#if deviceState?.last_frame?.timestamp}
          <div class="text-xs opacity-40 mt-1">
            Last frame: {formatTimestamp(deviceState.last_frame.timestamp)}
          </div>
        {/if}
      </div>
    {/each}
  {:else}
    <div class="text-sm opacity-60 text-center">No cameras configured</div>
  {/if}
</div>

<!-- Storage Info -->
<div class="salon-card-compact">
  <h4 class="font-medium mb-3">Storage</h4>
  <div class="space-y-2">
    <div class="flex justify-between text-sm">
      <span>Used Space:</span>
      <span class="font-medium">24% of 128 GB</span>
    </div>
    <div class="storage-bar">
      <div class="storage-fill" style="width: 24%"></div>
    </div>
    <div class="text-xs opacity-60 text-center">
      Automatic cleanup when 80% full
    </div>
  </div>
</div>

<style>
  .preview-container {
    aspect-ratio: 16 / 9;
    background: var(--neutral-100);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .preview-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--neutral-500);
  }

  .recording-dot {
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .text-red-600 {
    color: #dc2626;
  }

  .event-item {
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--neutral-100);
  }

  .event-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .space-y-2 > * + * {
    margin-top: var(--space-2);
  }

  .storage-bar {
    width: 100%;
    height: 6px;
    background: var(--neutral-200);
    border-radius: 3px;
    overflow: hidden;
  }

  .storage-fill {
    height: 100%;
    background: var(--accent);
    transition: width var(--transition-fast);
  }
</style>