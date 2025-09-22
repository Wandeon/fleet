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
      online: 'legacy-pill legacy-pill-success',
      degraded: 'legacy-pill legacy-pill-warning',
      offline: 'legacy-pill legacy-pill-error',
      unknown: 'legacy-pill legacy-pill-gray'
    };
    return classes[status] || classes.unknown;
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

<div class="dashboard">
  <div class="header">
    <h1>🚢 Fleet Management Dashboard</h1>
  </div>

  {#if loading}
    <div class="legacy-card">Loading...</div>
  {:else if error}
    <div class="legacy-alert legacy-alert-error">
      <strong>Error:</strong> {error}
    </div>
  {:else}
    <!-- System Health -->
    {#if healthStatus}
      <div class="legacy-grid legacy-grid-auto" style="margin-bottom: var(--legacy-space-xl);">
        <div class="legacy-card">
          <h3>🏥 System Health</h3>
          <div class="legacy-stat-value {healthStatus.status === 'healthy' ? 'healthy' : 'unhealthy'}">
            {(healthStatus.status || 'unknown').toUpperCase()}
          </div>
          <div class="legacy-stat-meta">
            {#if healthStatus.uptime}
              Uptime: {Math.round(healthStatus.uptime / 1000)}s
            {:else}
              API Status
            {/if}
          </div>
        </div>

        <div class="legacy-card">
          <h3>📱 Device Groups</h3>
          <div class="legacy-stat-value">{groups.length}</div>
          <div class="legacy-stat-meta">
            Total groups configured
          </div>
        </div>

        <div class="legacy-card">
          <h3>🎛️ Total Devices</h3>
          <div class="legacy-stat-value">
            {groups.reduce((total, group) => total + (group.devices?.length || 0), 0)}
          </div>
          <div class="legacy-stat-meta">
            Audio: {groups.filter(g => g.kind === 'audio').reduce((total, g) => total + (g.devices?.length || 0), 0)} •
            Video: {groups.filter(g => g.kind === 'video').reduce((total, g) => total + (g.devices?.length || 0), 0)} •
            Camera: {groups.filter(g => g.kind === 'camera').reduce((total, g) => total + (g.devices?.length || 0), 0)}
          </div>
        </div>
      </div>
    {/if}

    <!-- Device Groups -->
    {#if groups.length > 0}
      <div class="devices-section">
        <h2>🎛️ Device Group Overview</h2>
        <div class="legacy-grid legacy-grid-devices">
          {#each groups as group}
            <div class="legacy-card device-card">
              <div class="device-header">
                <h3>
                  {#if group.kind === 'audio'}🎵
                  {:else if group.kind === 'video'}📺
                  {:else if group.kind === 'camera'}📷
                  {:else if group.kind === 'zigbee'}🏠
                  {:else}📱{/if}
                  {group.name}
                </h3>
                <span class={getHealthBadgeClass(getGroupHealth(group))}>
                  {getGroupHealth(group)}
                </span>
              </div>

              <div class="device-info">
                <p><strong>Type:</strong> {group.kind}</p>
                <p><strong>Devices:</strong> {group.devices?.length || 0}</p>
                <p><strong>Status:</strong> {getGroupHealth(group)}</p>
              </div>

              <div class="device-actions">
                <a href={getGroupRoute(group.kind)} class="legacy-btn legacy-btn-primary">View & Control</a>
                <button class="legacy-btn legacy-btn-secondary">Quick Status</button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Quick Actions -->
    <div class="quick-actions">
      <h2>🚀 Quick Actions</h2>
      <div class="legacy-grid legacy-grid-auto-lg">
        <a href="/audio" class="legacy-card action-card">
          <h3>🎵 Audio Control</h3>
          <p>Manage audio playback, library uploads, and speaker control</p>
        </a>

        <a href="/video" class="legacy-card action-card">
          <h3>📺 Video Control</h3>
          <p>Control display devices, TV power, and media playback</p>
        </a>

        <a href="/cameras" class="legacy-card action-card">
          <h3>📷 Camera Control</h3>
          <p>Monitor camera feeds and manage video capture settings</p>
        </a>

        <a href="/smart-home" class="legacy-card action-card">
          <h3>🏠 Smart Home</h3>
          <p>Zigbee device pairing and smart home automation control</p>
        </a>
      </div>
    </div>
  {/if}
</div>

<style>
  .dashboard {
    space-y: 2rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .header h1 {
    margin: 0;
    color: var(--legacy-text-dark);
  }

  .devices-section {
    margin-bottom: 2rem;
  }

  .devices-section h2 {
    margin-bottom: 1rem;
    color: var(--legacy-text-dark);
  }

  .device-card {
    transition: transform 0.2s;
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .device-header h3 {
    margin: 0;
    color: var(--legacy-text-dark);
  }

  .device-info {
    margin-bottom: 1rem;
  }

  .device-info p {
    margin: 0.25rem 0;
    font-size: var(--legacy-font-size-sm);
    color: var(--legacy-text-medium);
  }

  .device-actions {
    display: flex;
    gap: 0.5rem;
  }

  .quick-actions h2 {
    margin-bottom: 1rem;
    color: var(--legacy-text-dark);
  }

  .action-card {
    text-decoration: none;
    color: inherit;
    transition: transform 0.2s;
  }

  .action-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--legacy-shadow-hover);
  }

  .action-card h3 {
    margin: 0 0 0.5rem 0;
    color: var(--legacy-text-dark);
  }

  .action-card p {
    margin: 0;
    color: var(--legacy-text-medium);
    font-size: var(--legacy-font-size-sm);
  }

  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }
  }
</style>

