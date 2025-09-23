<script lang="ts">
  import { onMount } from 'svelte';
  import { deviceStates, jobs } from '$lib/stores/deviceStates';
  import { getFleetLayout, getFleetState, postGroup, getKindStatus } from '$lib/api';
  import AudioModule from '$lib/components/AudioModule.svelte';
  import VideoModule from '$lib/components/VideoModule.svelte';
  import ZigbeeModule from '$lib/components/ZigbeeModule.svelte';
  import CameraModule from '$lib/components/CameraModule.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';

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

  let audioGroup: Group | undefined;
  let videoGroup: Group | undefined;
  let zigbeeGroup: Group | undefined;
  let cameraGroup: Group | undefined;
  let loading = true;
  let error: string | null = null;
  let expandedModule: string | null = null;

  onMount(async () => {
    try {
      const [layout, state] = await Promise.all([
        getFleetLayout(),
        getFleetState(),
      ]);

      // Handle both array and object formats for groups
      const groupsData = layout.groups || [];
      const groupsArray = Array.isArray(groupsData) ? groupsData : Object.values(groupsData);

      audioGroup = groupsArray.find((g: Group) => g.kind === 'audio');
      videoGroup = groupsArray.find((g: Group) => g.kind === 'video');
      zigbeeGroup = groupsArray.find((g: Group) => g.kind === 'zigbee');
      cameraGroup = groupsArray.find((g: Group) => g.kind === 'camera');

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

  function toggleModule(moduleName: string) {
    expandedModule = expandedModule === moduleName ? null : moduleName;
  }

  function getModuleStatus(group: Group | undefined, kind: string): { status: string; info: string } {
    if (!group || !group.devices?.length) {
      return { status: 'offline', info: 'No devices' };
    }

    const deviceStatuses = group.devices.map(device => {
      const state = $deviceStates[device.id];
      return state?.status || 'unknown';
    });

    const onlineCount = deviceStatuses.filter(s => s === 'online').length;
    const totalCount = deviceStatuses.length;

    if (onlineCount === totalCount) {
      // Module-specific info when all online
      switch (kind) {
        case 'audio':
          const audioState = $deviceStates[group.devices[0]?.id];
          return {
            status: 'ready',
            info: audioState?.playing ? `Playing: ${audioState.current_track || 'Unknown'}` : 'Ready'
          };
        case 'video':
          const videoState = $deviceStates[group.devices[0]?.id];
          return {
            status: 'ready',
            info: `${videoState?.power || 'Unknown'} • ${videoState?.input || 'Unknown'}`
          };
        case 'zigbee':
          return { status: 'ready', info: `${totalCount} devices` };
        case 'camera':
          const cameraState = $deviceStates[group.devices[0]?.id];
          const lastMotion = cameraState?.last_motion;
          return {
            status: 'ready',
            info: lastMotion ? `Last motion ${new Date(lastMotion).toLocaleTimeString()}` : 'Monitoring'
          };
        default:
          return { status: 'ready', info: `${onlineCount}/${totalCount} online` };
      }
    } else if (onlineCount > 0) {
      return { status: 'degraded', info: `${onlineCount}/${totalCount} online` };
    } else {
      return { status: 'offline', info: 'All offline' };
    }
  }

  function getCurrentTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Update time every minute
  let currentTime = getCurrentTime();
  setInterval(() => {
    currentTime = getCurrentTime();
  }, 60000);
</script>

<div class="salon-layout">
  <main class="salon-main">
    <!-- Header -->
    <header class="salon-header">
      <h1 class="salon-title">Head Spa Control</h1>
      <div class="salon-header-info">
        <span>Now</span>
        <span class="status-dot ready"></span>
        <span>{currentTime}</span>
      </div>
    </header>

    {#if loading}
      <div class="salon-card">
        <p class="text-center">Loading control systems...</p>
      </div>
    {:else if error}
      <div class="salon-card">
        <p class="text-center" style="color: var(--danger)">Error: {error}</p>
      </div>
    {:else}
      <!-- Audio Module -->
      {#if audioGroup}
        {@const moduleStatus = getModuleStatus(audioGroup, 'audio')}
        <div class="module">
          <div
            class="module-header"
            class:expanded={expandedModule === 'audio'}
            on:click={() => toggleModule('audio')}
          >
            <div class="module-header-left">
              <span class="module-icon">🎵</span>
              <h3 class="module-title">Audio</h3>
              <span class="status-dot {moduleStatus.status}"></span>
              <span class="module-status">{moduleStatus.info}</span>
            </div>
            <span class="module-expand-icon">▶</span>
          </div>
          {#if expandedModule === 'audio'}
            <div class="module-content">
              <AudioModule {audioGroup} />
            </div>
          {/if}
        </div>
      {/if}

      <!-- Video Module -->
      {#if videoGroup}
        {@const moduleStatus = getModuleStatus(videoGroup, 'video')}
        <div class="module">
          <div
            class="module-header"
            class:expanded={expandedModule === 'video'}
            on:click={() => toggleModule('video')}
          >
            <div class="module-header-left">
              <span class="module-icon">📺</span>
              <h3 class="module-title">Video</h3>
              <span class="status-dot {moduleStatus.status}"></span>
              <span class="module-status">{moduleStatus.info}</span>
            </div>
            <span class="module-expand-icon">▶</span>
          </div>
          {#if expandedModule === 'video'}
            <div class="module-content">
              <VideoModule {videoGroup} />
            </div>
          {/if}
        </div>
      {/if}

      <!-- Zigbee Module -->
      {#if zigbeeGroup}
        {@const moduleStatus = getModuleStatus(zigbeeGroup, 'zigbee')}
        <div class="module">
          <div
            class="module-header"
            class:expanded={expandedModule === 'zigbee'}
            on:click={() => toggleModule('zigbee')}
          >
            <div class="module-header-left">
              <span class="module-icon">🐝</span>
              <h3 class="module-title">Zigbee</h3>
              <span class="status-dot {moduleStatus.status}"></span>
              <span class="module-status">{moduleStatus.info}</span>
            </div>
            <span class="module-expand-icon">▶</span>
          </div>
          {#if expandedModule === 'zigbee'}
            <div class="module-content">
              <ZigbeeModule {zigbeeGroup} />
            </div>
          {/if}
        </div>
      {/if}

      <!-- Camera Module -->
      {#if cameraGroup}
        {@const moduleStatus = getModuleStatus(cameraGroup, 'camera')}
        <div class="module">
          <div
            class="module-header"
            class:expanded={expandedModule === 'camera'}
            on:click={() => toggleModule('camera')}
          >
            <div class="module-header-left">
              <span class="module-icon">🎥</span>
              <h3 class="module-title">Camera</h3>
              <span class="status-dot {moduleStatus.status}"></span>
              <span class="module-status">{moduleStatus.info}</span>
            </div>
            <span class="module-expand-icon">▶</span>
          </div>
          {#if expandedModule === 'camera'}
            <div class="module-content">
              <CameraModule {cameraGroup} />
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </main>

  <!-- Right Sidebar -->
  <Sidebar />
</div>