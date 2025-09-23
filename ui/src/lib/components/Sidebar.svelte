<script lang="ts">
  import { deviceStates, jobs } from '$lib/stores/deviceStates';
  import { postGroup } from '$lib/api';

  let routineRunning: string | null = null;
  let activityLog: Array<{timestamp: string, message: string, type: string}> = [];

  // Salon Routines
  const routines = {
    openSalon: [
      {kind: "video", cmd: "power_on"},
      {kind: "video", cmd: "input", args: {source: "hdmi1"}},
      {kind: "audio", cmd: "play", args: {playlist: "Ambient"}},
      {kind: "audio", cmd: "volume", args: {value: 0.55}},
    ],
    startTreatment: [
      {kind: "audio", cmd: "play", args: {playlist: "Relax"}},
      {kind: "audio", cmd: "volume", args: {value: 0.40}},
    ],
    endTreatment: [
      {kind: "audio", cmd: "pause"},
    ],
    closeSalon: [
      {kind: "video", cmd: "power_off"},
      {kind: "audio", cmd: "stop"},
    ]
  };

  async function executeRoutine(routineName: string) {
    if (routineRunning) return;

    routineRunning = routineName;
    const routine = routines[routineName];

    logActivity(`Starting ${routineName.replace(/([A-Z])/g, ' $1').toLowerCase()}`, 'routine');

    try {
      for (const step of routine) {
        const groupName = getGroupName(step.kind);
        if (groupName) {
          await postGroup(groupName, step.cmd, step.args);
          logActivity(`${step.kind}: ${step.cmd}`, 'action');
        }
      }
      logActivity(`${routineName.replace(/([A-Z])/g, ' $1').toLowerCase()} completed`, 'success');
    } catch (error) {
      logActivity(`${routineName} failed: ${error.message}`, 'error');
    } finally {
      routineRunning = null;
    }
  }

  function getGroupName(kind: string): string {
    const groupMap = {
      'audio': 'all-audio',
      'video': 'all-displays',
      'zigbee': 'zigbee-hubs',
      'camera': 'exterior-cams'
    };
    return groupMap[kind] || '';
  }

  function logActivity(message: string, type: string) {
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    activityLog = [entry, ...activityLog.slice(0, 19)]; // Keep last 20
  }

  function getSystemHealth() {
    const allStates = Object.values($deviceStates);
    const onlineDevices = allStates.filter(state => state?.status === 'online').length;
    const totalDevices = allStates.length;

    return {
      api: 'online', // Assume online if we're getting data
      sse: 'online', // Assume online if store is updating
      devices: `${onlineDevices}/${totalDevices}`
    };
  }

  $: health = getSystemHealth();
</script>

<aside class="salon-sidebar">
  <!-- Quick Actions -->
  <div class="quick-actions">
    <h3>Quick Actions</h3>

    <button
      class="salon-btn salon-btn-success salon-btn-large quick-action-btn"
      disabled={routineRunning !== null}
      on:click={() => executeRoutine('openSalon')}
    >
      {#if routineRunning === 'openSalon'}
        Opening Salon...
      {:else}
        Open Salon
      {/if}
    </button>

    <button
      class="salon-btn salon-btn-primary salon-btn-large quick-action-btn"
      disabled={routineRunning !== null}
      on:click={() => executeRoutine('startTreatment')}
    >
      {#if routineRunning === 'startTreatment'}
        Starting Treatment...
      {:else}
        Start Treatment
      {/if}
    </button>

    <button
      class="salon-btn salon-btn-secondary salon-btn-large quick-action-btn"
      disabled={routineRunning !== null}
      on:click={() => executeRoutine('endTreatment')}
    >
      {#if routineRunning === 'endTreatment'}
        Ending Treatment...
      {:else}
        End Treatment
      {/if}
    </button>

    <button
      class="salon-btn salon-btn-danger salon-btn-large quick-action-btn"
      disabled={routineRunning !== null}
      on:click={() => executeRoutine('closeSalon')}
    >
      {#if routineRunning === 'closeSalon'}
        Closing Salon...
      {:else}
        Close Salon
      {/if}
    </button>
  </div>

  <!-- System Health -->
  <div class="salon-card-compact">
    <h3 class="mb-4">System Health</h3>
    <div class="health-grid">
      <div class="health-item">
        <span class="status-dot {health.api === 'online' ? 'ready' : 'offline'}"></span>
        <span>API</span>
      </div>
      <div class="health-item">
        <span class="status-dot {health.sse === 'online' ? 'ready' : 'offline'}"></span>
        <span>SSE</span>
      </div>
      <div class="health-item">
        <span class="status-dot ready"></span>
        <span>Devices {health.devices}</span>
      </div>
    </div>
  </div>

  <!-- Notifications -->
  <div class="salon-card-compact">
    <h3 class="mb-4">Notifications</h3>
    <div class="text-sm opacity-60 text-center">
      All systems operational
    </div>
  </div>

  <!-- Activity Log -->
  <div class="salon-card-compact">
    <h3 class="mb-4">Activity Log</h3>
    <div class="activity-log">
      {#each activityLog as entry}
        <div class="log-entry">
          <div>
            <div class="text-sm">{entry.message}</div>
            <div class="log-time">{entry.timestamp}</div>
          </div>
          <div class="status-dot {entry.type === 'success' ? 'ready' : entry.type === 'error' ? 'error' : 'offline'}"></div>
        </div>
      {:else}
        <div class="text-sm opacity-60 text-center">No recent activity</div>
      {/each}
    </div>
  </div>
</aside>

<style>
  .quick-action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>