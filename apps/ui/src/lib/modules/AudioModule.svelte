<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Slider from '$lib/components/Slider.svelte';
  import DeviceTile from '$lib/components/DeviceTile.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import { createEventDispatcher } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { browser } from '$app/environment';
  import { goto, invalidate } from '$app/navigation';
  import { resolve } from '$app/paths';
  import {
    createPlaylist,
    deletePlaylist,
    pauseDevice,
    playOnDevices,
    resumeDevice,
    seekDevice,
    setDeviceVolume,
    setMasterVolume,
    stopDevice,
    updatePlaylist,
    uploadTrack,
    uploadFallback,
    getDeviceSnapshot,
  } from '$lib/api/audio-operations';
  import type { PanelState } from '$lib/stores/app';
  import type {
    AudioDeviceSnapshot,
    AudioPlaylist,
    AudioPlaylistTrack,
    AudioState,
    AudioSyncMode,
  } from '$lib/types';

  export let data: AudioState | null = null;
  export let state: PanelState = 'success';
  export let variant: 'compact' | 'full' = 'full';
  export let title = 'Audio';
  export let onRetry: (() => void) | undefined;

  const dispatch = createEventDispatcher();

  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '0:00';
    const total = Math.max(0, Math.round(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatRelative = (iso: string | null) => {
    if (!iso) return '—';
    const value = new Date(iso).valueOf();
    const now = Date.now();
    const diff = Math.max(0, now - value);
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  };

  const computeStatus = (device: AudioDeviceSnapshot) => {
    if (device.status === 'error') return 'error';
    if (device.status === 'offline') return 'offline';
    if (device.playback.state === 'buffering') return 'warn';
    return 'ok';
  };

  let selectedDevices = new SvelteSet<string>();
  let playbackMode: 'single' | 'perDevice' | 'playlist' = 'single';
  let selectedTrackId: string | null = null;
  let selectedPlaylistId: string | null = null;
  let syncMode: AudioSyncMode = 'synced';
  let resumePlayback = false;
  let loopPlayback = false;
  let startAtSeconds = 0;
  let playbackError = '';
  let playbackBusy = false;
  let banner: { type: 'success' | 'error'; message: string } | null = null;

  let deviceAssignments: Record<string, string | null> = {};
  $: assignmentList = Array.from(selectedDevices).map((deviceId) => ({
    deviceId,
    trackId: deviceAssignments[deviceId] ?? null,
  }));

  $: library = data?.library ?? [];
  $: playlists = data?.playlists ?? [];
  $: devices = data?.devices ?? [];

  let uploadModalOpen = false;
  let uploadFile: File | null = null;
  let uploadTitle = '';
  let uploadArtist = '';
  let uploadTags = '';
  let uploadError = '';
  let uploadBusy = false;
  let deviceUploadBusy: Record<string, boolean> = {};

  let playlistModalOpen = false;
  let playlistEditingId: string | null = null;
  let playlistName = '';
  let playlistDescription = '';
  let playlistLoop = true;
  let playlistSyncMode: AudioSyncMode = 'synced';
  let playlistTrackSelections: Record<string, boolean> = {};
  let playlistBusy = false;
  let playlistError = '';

  const assignmentsEqual = (
    prev: Record<string, string | null>,
    next: Record<string, string | null>
  ): boolean => {
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    if (prevKeys.length !== nextKeys.length) return false;
    for (const key of nextKeys) {
      if (prev[key] !== next[key]) return false;
    }
    return true;
  };

  const reconcileAssignments = (selection: Set<string>) => {
    const nextAssignments: Record<string, string | null> = {};
    for (const deviceId of selection) {
      nextAssignments[deviceId] = deviceAssignments[deviceId] ?? null;
    }
    if (!assignmentsEqual(deviceAssignments, nextAssignments)) {
      deviceAssignments = nextAssignments;
    }
  };

  const setSelectedDevices = (ids: Iterable<string>) => {
    const nextSelection = new SvelteSet(ids);
    selectedDevices = nextSelection;
    reconcileAssignments(nextSelection);
  };

  const resetBanner = () => {
    banner = null;
  };

  const broadcastRefresh = () => {
    dispatch('refresh');
    invalidate('app:audio');
    onRetry?.();
  };

  const setDeviceUploadBusy = (deviceId: string, busy: boolean) => {
    deviceUploadBusy = { ...deviceUploadBusy, [deviceId]: busy };
  };

  const handleDeviceUpload = (device: AudioDeviceSnapshot) => {
    if (!browser || deviceUploadBusy[device.id]) {
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.addEventListener('change', async () => {
      const selected = input.files?.[0] ?? null;
      input.remove();
      if (!selected) return;

      if (selected.size > 50 * 1024 * 1024) {
        showError('File too large. Maximum size is 50 MB.');
        return;
      }

      setDeviceUploadBusy(device.id, true);
      try {
        await uploadFallback(device.id, selected);
        const snapshot = await getDeviceSnapshot(device.id);
        updateDevice(snapshot);
        showSuccess('Upload successful');
        broadcastRefresh();
      } catch (error) {
        console.error('fallback upload error', error);
        const status = typeof (error as { status?: number })?.status === 'number'
          ? (error as { status: number }).status
          : undefined;
        const detail = (error as { detail?: unknown })?.detail;
        if (status === 401 || status === 403) {
          showError('Not authorized to upload audio. Refresh and try again.');
        } else if (
          status === 400 &&
          typeof detail === 'object' &&
          detail !== null &&
          'code' in (detail as { code?: unknown }) &&
          (detail as { code?: unknown }).code === 'file_too_large'
        ) {
          showError('File too large. Maximum size is 50 MB.');
        } else if (status && [502, 503, 504].includes(status)) {
          showError('Device offline. Check power or network and retry.');
        } else {
          showError('Upload failed');
        }
      } finally {
        setDeviceUploadBusy(device.id, false);
      }
    });

    input.click();
  };

  const openAudioControl = () => {
    const audioRoute = resolve('/audio');
    void goto(audioRoute);
  };

  const toggleDeviceSelection = (deviceId: string) => {
    const next = new SvelteSet(selectedDevices);
    if (next.has(deviceId)) {
      next.delete(deviceId);
    } else {
      next.add(deviceId);
    }
    setSelectedDevices(next);
  };

  const updateState = (next: AudioState) => {
    data = next;
    broadcastRefresh();
  };

  const updateDevice = (snapshot: AudioDeviceSnapshot) => {
    if (!data) return;
    data = {
      ...data,
      devices: data.devices.map((item) => (item.id === snapshot.id ? snapshot : item)),
    };
  };

  const showSuccess = (message: string) => {
    banner = { type: 'success', message };
    setTimeout(() => {
      if (banner?.message === message) banner = null;
    }, 4000);
  };

  const showError = (message: string) => {
    banner = { type: 'error', message };
  };

  const validatePlayback = () => {
    playbackError = '';
    if (!selectedDevices.size) {
      playbackError = 'Select at least one device to start playback.';
      return false;
    }

    if (playbackMode === 'single' && !selectedTrackId) {
      playbackError = 'Choose a track to play on the selected devices.';
      return false;
    }

    if (playbackMode === 'perDevice') {
      const missing = assignmentList.filter((assignment) => !assignment.trackId);
      if (missing.length) {
        playbackError = 'Assign a track for every selected device.';
        return false;
      }
    }

    if (playbackMode === 'playlist' && !selectedPlaylistId) {
      playbackError = 'Select a playlist to deploy to the devices.';
      return false;
    }

    return true;
  };

  const handlePlayback = async () => {
    if (!data || playbackBusy) return;
    if (!validatePlayback()) return;

    playbackBusy = true;
    try {
      const state = await playOnDevices({
        deviceIds: Array.from(selectedDevices),
        trackId: playbackMode === 'single' ? selectedTrackId : null,
        playlistId: playbackMode === 'playlist' ? selectedPlaylistId : null,
        assignments:
          playbackMode === 'perDevice'
            ? assignmentList.map(({ deviceId, trackId }) => ({ deviceId, trackId: trackId! }))
            : undefined,
        syncMode,
        resume: resumePlayback,
        loop: loopPlayback,
        startAtSeconds,
      });
      updateState(state);
      showSuccess('Playback started');
    } catch (error) {
      console.error('playback error', error);
      showError(error instanceof Error ? error.message : 'Failed to start playback');
    } finally {
      playbackBusy = false;
    }
  };

  const handleDeviceToggle = async (device: AudioDeviceSnapshot) => {
    if (!data) return;
    try {
      const updated =
        device.playback.state === 'playing'
          ? await pauseDevice(device.id)
          : await resumeDevice(device.id);
      updateDevice(updated);
    } catch (error) {
      console.error('toggle playback', error);
      showError('Unable to toggle playback');
    }
  };

  const handleDeviceStop = async (device: AudioDeviceSnapshot) => {
    try {
      const updated = await stopDevice(device.id);
      updateDevice(updated);
    } catch (error) {
      console.error('stop device', error);
      showError('Unable to stop device');
    }
  };

  const handleDeviceResync = async (device: AudioDeviceSnapshot) => {
    if (!device.playback.trackId && !device.playback.playlistId) {
      showError('No active source to re-sync');
      return;
    }

    try {
      const state = await playOnDevices({
        deviceIds: [device.id],
        trackId: device.playback.trackId,
        playlistId: device.playback.playlistId,
        assignments: undefined,
        syncMode: 'synced',
        resume: true,
        startAtSeconds: device.playback.positionSeconds ?? 0,
        loop: false,
      });
      updateState(state);
      showSuccess(`Re-synced ${device.name}`);
    } catch (error) {
      console.error('resync device', error);
      showError('Unable to re-sync device');
    }
  };

  const handleVolume = async (device: AudioDeviceSnapshot, value: number) => {
    try {
      const updated = await setDeviceVolume(device.id, value);
      updateDevice(updated);
    } catch (error) {
      console.error('volume error', error);
      showError('Unable to adjust volume');
    }
  };

  const handleSeek = async (device: AudioDeviceSnapshot, value: number) => {
    try {
      const updated = await seekDevice(device.id, value);
      updateDevice(updated);
    } catch (error) {
      console.error('seek error', error);
      showError('Unable to seek');
    }
  };

  const handleMasterVolume = async (value: number) => {
    try {
      const state = await setMasterVolume(value);
      updateState(state);
      showSuccess('Updated master gain');
    } catch (error) {
      console.error('master volume', error);
      showError('Unable to update master volume');
    }
  };

  const openUploadModal = () => {
    uploadModalOpen = true;
    uploadFile = null;
    uploadTitle = '';
    uploadArtist = '';
    uploadTags = '';
    uploadError = '';
  };

  const handleUpload = async () => {
    if (!data || uploadBusy) return;
    uploadError = '';

    if (!uploadFile) {
      uploadError = 'Select an audio file to upload.';
      return;
    }

    const title = uploadTitle.trim() || uploadFile.name.replace(/\.[^.]+$/, '');

    uploadBusy = true;
    try {
      const track = await uploadTrack({
        file: uploadFile,
        title,
        artist: uploadArtist.trim() || undefined,
        tags: uploadTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      data = {
        ...data,
        library: [...data.library, track],
      };
      showSuccess(`Uploaded ${track.title}`);
      uploadModalOpen = false;
      broadcastRefresh();
    } catch (error) {
      console.error('upload error', error);
      uploadError = error instanceof Error ? error.message : 'Upload failed';
    } finally {
      uploadBusy = false;
    }
  };

  const openPlaylistModal = (playlist?: AudioPlaylist) => {
    playlistModalOpen = true;
    playlistError = '';
    playlistBusy = false;
    if (playlist) {
      playlistEditingId = playlist.id;
      playlistName = playlist.name;
      playlistDescription = playlist.description ?? '';
      playlistLoop = playlist.loop;
      playlistSyncMode = playlist.syncMode;
      const selection: Record<string, boolean> = {};
      playlist.tracks.forEach((track) => {
        selection[track.trackId] = true;
      });
      playlistTrackSelections = selection;
    } else {
      playlistEditingId = null;
      playlistName = '';
      playlistDescription = '';
      playlistLoop = true;
      playlistSyncMode = 'synced';
      playlistTrackSelections = {};
    }
  };

  const handlePlaylistSubmit = async () => {
    if (!data || playlistBusy) return;
    const tracks: AudioPlaylistTrack[] = library
      .filter((track) => playlistTrackSelections[track.id])
      .map((track, idx) => ({ trackId: track.id, order: idx + 1 }));

    if (!playlistName.trim()) {
      playlistError = 'Name your playlist to continue.';
      return;
    }

    if (!tracks.length) {
      playlistError = 'Select at least one track.';
      return;
    }

    playlistBusy = true;

    try {
      if (playlistEditingId) {
        const updated = await updatePlaylist(playlistEditingId, {
          name: playlistName.trim(),
          description: playlistDescription.trim() || null,
          loop: playlistLoop,
          syncMode: playlistSyncMode,
          tracks,
        });
        data = {
          ...data,
          playlists: data.playlists.map((playlist) =>
            playlist.id === updated.id ? updated : playlist
          ),
        };
        showSuccess(`Updated playlist “${updated.name}”`);
      } else {
        const created = await createPlaylist({
          name: playlistName.trim(),
          description: playlistDescription.trim() || null,
          loop: playlistLoop,
          syncMode: playlistSyncMode,
          tracks,
        });
        data = {
          ...data,
          playlists: [...data.playlists, created],
        };
        showSuccess(`Playlist “${created.name}” created`);
      }
      playlistModalOpen = false;
      broadcastRefresh();
    } catch (error) {
      console.error('playlist error', error);
      playlistError = error instanceof Error ? error.message : 'Unable to save playlist';
    } finally {
      playlistBusy = false;
    }
  };

  const handleDeletePlaylist = async (playlist: AudioPlaylist) => {
    if (!data) return;
    if (!confirm(`Delete playlist “${playlist.name}”?`)) return;
    try {
      await deletePlaylist(playlist.id);
      data = {
        ...data,
        playlists: data.playlists.filter((item) => item.id !== playlist.id),
      };
      showSuccess('Playlist removed');
      broadcastRefresh();
    } catch (error) {
      console.error('delete playlist', error);
      showError('Unable to delete playlist');
    }
  };

  const handlePlayPlaylist = async (playlist: AudioPlaylist) => {
    selectedPlaylistId = playlist.id;
    playbackMode = 'playlist';
    await handlePlayback();
  };

  const createAssignmentChangeHandler = (deviceId: string) => (event: Event) => {
    const value = (event.target as HTMLSelectElement).value || null;
    deviceAssignments = { ...deviceAssignments, [deviceId]: value };
  };
</script>

<Card
  {title}
  subtitle={variant === 'compact' ? 'Fleet-wide audio health' : 'Distributed audio orchestration'}
>
  {#if state === 'loading'}
    <div class="loading">
      <Skeleton variant="block" height="7rem" />
      <Skeleton variant="block" height="14rem" />
    </div>
  {:else if state === 'error'}
    <div class="error-state" role="alert">
      <p>Audio subsystem unreachable. Retry fetching telemetry?</p>
      <Button variant="primary" on:click={() => onRetry?.()}>Retry</Button>
    </div>
  {:else if !data || data.devices.length === 0}
    <EmptyState
      title="No audio devices discovered"
      description="Bring a player online or pair a Pi to begin."
    >
      <svelte:fragment slot="icon">🔈</svelte:fragment>
      <svelte:fragment slot="actions">
        <Button variant="secondary" on:click={() => onRetry?.()}>Refresh</Button>
      </svelte:fragment>
    </EmptyState>
  {:else if variant === 'compact'}
    <div class="compact-overview">
      <div class="overview-row">
        <div class="metric">
          <span>Master volume</span>
          <strong>{Math.round(data.masterVolume)}%</strong>
        </div>
        <div class="metric">
          <span>Online devices</span>
          <strong>
            {data.devices.filter((device) => device.status === 'online').length}/{data.devices
              .length}
          </strong>
        </div>
        <div class="metric">
          <span>Active playlists</span>
          <strong>{data.sessions.length}</strong>
        </div>
      </div>
      <ul class="compact-list">
        {#each data.devices.slice(0, 3) as device (device.id)}
          <li>
            <StatusPill status={computeStatus(device)} />
            <span class="device-name">{device.name}</span>
            <span class="device-extra">
              {#if device.playback.state === 'playing'}
                ▶ {device.playback.trackTitle ?? 'Unknown track'} ({formatDuration(
                  device.playback.positionSeconds
                )})
              {:else if device.playback.state === 'paused'}
                ❚❚ {device.playback.trackTitle ?? 'Paused'}
              {:else}
                Idle
              {/if}
            </span>
          </li>
        {/each}
      </ul>
      <Button variant="ghost" on:click={openAudioControl}>Open audio control</Button>
    </div>
  {:else}
    <div class="audio-layout">
      {#if banner}
        <div class={`banner ${banner.type}`} role="status">
          <span>{banner.message}</span>
          <button type="button" on:click={resetBanner} aria-label="Dismiss message">×</button>
        </div>
      {/if}

      <section class="master">
        <div>
          <h2>Master mix</h2>
          <p>Set headroom and monitor fleet playback status.</p>
        </div>
        <div class="master-controls">
          <Slider
            label="Master volume"
            min={0}
            max={200}
            value={data.masterVolume}
            unit="%"
            on:change={(event) => handleMasterVolume(event.detail)}
          />
          <div class="master-summary">
            <span>{data.library.length} tracks</span>
            <span>{data.playlists.length} playlists</span>
            <span>{data.sessions.length} active sessions</span>
          </div>
        </div>
      </section>

      <section class="device-grid">
        <header>
          <h2>Devices</h2>
          <p>Select endpoints for playback orchestration.</p>
        </header>
        <div class="grid">
          {#each data.devices as device (device.id)}
            <DeviceTile
              title={device.name}
              subtitle={device.playback.trackTitle ?? 'Idle'}
              status={computeStatus(device)}
              busy={playbackBusy || !!deviceUploadBusy[device.id]}
            >
              <div class="device-controls">
                <div class="device-meta">
                  <span class={`state state-${device.playback.state}`}>
                    {device.playback.state === 'playing'
                      ? 'Playing'
                      : device.playback.state === 'paused'
                        ? 'Paused'
                        : device.playback.state === 'buffering'
                          ? 'Buffering'
                          : device.playback.state === 'error'
                            ? 'Error'
                            : 'Idle'}
                  </span>
                  <span class="position">
                    {formatDuration(device.playback.positionSeconds)} / {formatDuration(
                      device.playback.durationSeconds
                    )}
                  </span>
                  <span class="updated">{formatRelative(device.lastUpdated)}</span>
                </div>
                <div class="device-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    on:click={() => toggleDeviceSelection(device.id)}
                    aria-pressed={selectedDevices.has(device.id)}
                  >
                    {selectedDevices.has(device.id) ? 'Selected' : 'Select'}
                  </Button>
                  <Button variant="primary" size="sm" on:click={() => handleDeviceToggle(device)}>
                    {device.playback.state === 'playing' ? 'Pause' : 'Play'}
                  </Button>
                  <Button variant="ghost" size="sm" on:click={() => handleDeviceStop(device)}>
                    Stop
                  </Button>
                  {#if device.playback.syncGroup && (device.playback.trackId || device.playback.playlistId)}
                    <Button variant="ghost" size="sm" on:click={() => handleDeviceResync(device)}>
                      Re-sync
                    </Button>
                  {/if}
                </div>
                <div class="device-sliders">
                  <Slider
                    label="Volume"
                    min={0}
                    max={200}
                    value={device.volumePercent}
                    unit="%"
                    on:change={(event) => handleVolume(device, event.detail)}
                  />
                  <Slider
                    label="Seek"
                    min={0}
                    max={Math.max(
                      device.playback.durationSeconds,
                      device.playback.positionSeconds + 1
                    )}
                    value={device.playback.positionSeconds}
                    step={1}
                    on:change={(event) => handleSeek(device, event.detail)}
                    displayValue={false}
                  />
                </div>
              </div>
              <svelte:fragment slot="actions">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!!deviceUploadBusy[device.id]}
                  on:click={() => handleDeviceUpload(device)}
                  title="Upload emergency audio for offline fallback"
                >
                  {deviceUploadBusy[device.id] ? 'Uploading…' : 'Replace fallback'}
                </Button>
                <span
                  class={`pill ${device.fallbackExists ? 'success' : 'warn'}`}
                  role="status"
                  aria-live="polite"
                >
                  {device.fallbackExists ? 'Fallback ready' : 'No fallback'}
                </span>
                {#if device.playback.playlistId}
                  <span class="pill">Playlist · {device.playback.playlistId}</span>
                {/if}
                {#if device.playback.syncGroup}
                  <span class="pill">Sync · {device.playback.syncGroup}</span>
                {/if}
                {#if device.playback.lastError}
                  <span class="pill alert" role="status">⚠ {device.playback.lastError}</span>
                {/if}
              </svelte:fragment>
            </DeviceTile>
          {/each}
        </div>
      </section>

      <section class="orchestrator">
        <header>
          <h2>Orchestrate playback</h2>
          <p>Deploy tracks or playlists across selected devices.</p>
        </header>
        <div class="orchestrator-body">
          <div class="mode-toggle" role="group" aria-label="Playback mode">
            <Button
              variant={playbackMode === 'single' ? 'primary' : 'ghost'}
              on:click={() => (playbackMode = 'single')}
            >
              Single track
            </Button>
            <Button
              variant={playbackMode === 'perDevice' ? 'primary' : 'ghost'}
              on:click={() => (playbackMode = 'perDevice')}
            >
              Per device
            </Button>
            <Button
              variant={playbackMode === 'playlist' ? 'primary' : 'ghost'}
              on:click={() => (playbackMode = 'playlist')}
            >
              Playlist
            </Button>
          </div>
          {#if playbackMode === 'single'}
            <div class="mode-content">
              <label>
                <span>Track</span>
                <select bind:value={selectedTrackId}>
                  <option value="">Select a track</option>
                  {#each library as track (track.id)}
                    <option value={track.id}>{track.title}</option>
                  {/each}
                </select>
              </label>
            </div>
          {:else if playbackMode === 'perDevice'}
            <div class="mode-content per-device">
              {#if !selectedDevices.size}
                <p>Select devices first to assign tracks.</p>
              {:else}
                {#each assignmentList as assignment (assignment.deviceId)}
                  <label>
                    <span
                      >{devices.find((item) => item.id === assignment.deviceId)?.name ??
                        assignment.deviceId}</span
                    >
                    <select
                      value={assignment.trackId ?? ''}
                      on:change={createAssignmentChangeHandler(assignment.deviceId)}
                    >
                      <option value="">Choose track</option>
                      {#each library as track (track.id)}
                        <option value={track.id}>{track.title}</option>
                      {/each}
                    </select>
                  </label>
                {/each}
              {/if}
            </div>
          {:else}
            <div class="mode-content">
              <label>
                <span>Playlist</span>
                <select bind:value={selectedPlaylistId}>
                  <option value="">Select a playlist</option>
                  {#each playlists as playlist (playlist.id)}
                    <option value={playlist.id}>{playlist.name}</option>
                  {/each}
                </select>
              </label>
            </div>
          {/if}
          <div class="mode-options">
            <label class="checkbox">
              <input type="checkbox" bind:checked={resumePlayback} />
              <span>Resume where tracks left off</span>
            </label>
            <label class="checkbox">
              <input type="checkbox" bind:checked={loopPlayback} />
              <span>Loop playback</span>
            </label>
            <label>
              <span>Sync mode</span>
              <select bind:value={syncMode}>
                <option value="synced">Synced</option>
                <option value="grouped">Grouped</option>
                <option value="independent">Independent</option>
              </select>
            </label>
            <label>
              <span>Start at (seconds)</span>
              <input type="number" min="0" bind:value={startAtSeconds} />
            </label>
          </div>
          {#if playbackError}
            <p class="form-error" role="alert">{playbackError}</p>
          {/if}
          <div class="orchestrator-actions">
            <Button variant="secondary" on:click={() => setSelectedDevices([])}
              >Clear selection</Button
            >
            <Button variant="primary" disabled={playbackBusy} on:click={handlePlayback}>
              {playbackBusy ? 'Starting…' : 'Start playback'}
            </Button>
          </div>
        </div>
      </section>

      <section class="library">
        <header>
          <h2>Library</h2>
          <div class="actions">
            <Button variant="ghost" on:click={openUploadModal}>Upload track</Button>
          </div>
        </header>
        <table>
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Artist</th>
              <th scope="col">Duration</th>
              <th scope="col">Tags</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each library as track (track.id)}
              <tr>
                <th scope="row">{track.title}</th>
                <td>{track.artist ?? '—'}</td>
                <td>{formatDuration(track.durationSeconds)}</td>
                <td>{track.tags?.join(', ') ?? '—'}</td>
                <td class="library-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    on:click={() => {
                      selectedTrackId = track.id;
                      playbackMode = 'single';
                      handlePlayback();
                    }}
                    title="Play this track on all selected devices"
                  >
                    Play on both
                  </Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>

      <section class="playlists">
        <header>
          <h2>Playlists</h2>
          <div class="actions">
            <Button variant="ghost" on:click={() => openPlaylistModal()}>New playlist</Button>
          </div>
        </header>
        {#if !playlists.length}
          <p class="muted">No playlists yet. Create one from the library above.</p>
        {:else}
          <ul class="playlist-list">
            {#each playlists as playlist (playlist.id)}
              <li>
                <div class="playlist-meta">
                  <div>
                    <strong>{playlist.name}</strong>
                    <span>{playlist.description ?? 'No description'}</span>
                  </div>
                  <div class="tags">
                    <span class="pill">{playlist.tracks.length} tracks</span>
                    <span class="pill">{playlist.syncMode}</span>
                    {#if playlist.loop}
                      <span class="pill">Loop</span>
                    {/if}
                  </div>
                </div>
                <div class="playlist-actions">
                  <Button variant="ghost" size="sm" on:click={() => handlePlayPlaylist(playlist)} title="Deploy playlist to all selected devices">
                    Play on both
                  </Button>
                  <Button variant="ghost" size="sm" on:click={() => openPlaylistModal(playlist)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" on:click={() => handleDeletePlaylist(playlist)}>
                    Delete
                  </Button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  {/if}

  {#if uploadModalOpen}
    <div class="modal" role="dialog" aria-modal="true" aria-label="Upload audio track">
      <div class="modal-content">
        <header>
          <h3>Upload audio</h3>
          <button type="button" on:click={() => (uploadModalOpen = false)} aria-label="Close"
            >×</button
          >
        </header>
        <div class="modal-body">
          <label>
            <span>Audio file</span>
            <input
              type="file"
              accept="audio/*"
              on:change={(event) => {
                const target = event.target as HTMLInputElement;
                uploadFile = target.files?.[0] ?? null;
              }}
            />
          </label>
          <label>
            <span>Title</span>
            <input type="text" bind:value={uploadTitle} placeholder="Track title" />
          </label>
          <label>
            <span>Artist</span>
            <input type="text" bind:value={uploadArtist} placeholder="Artist" />
          </label>
          <label>
            <span>Tags (comma separated)</span>
            <input type="text" bind:value={uploadTags} placeholder="ambient, lobby" />
          </label>
          {#if uploadError}
            <p class="form-error" role="alert">{uploadError}</p>
          {/if}
        </div>
        <footer>
          <Button variant="ghost" on:click={() => (uploadModalOpen = false)}>Cancel</Button>
          <Button variant="primary" disabled={uploadBusy} on:click={handleUpload}>
            {uploadBusy ? 'Uploading…' : 'Upload'}
          </Button>
        </footer>
      </div>
    </div>
  {/if}

  {#if playlistModalOpen}
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-label={playlistEditingId ? 'Edit playlist' : 'Create playlist'}
    >
      <div class="modal-content wide">
        <header>
          <h3>{playlistEditingId ? 'Edit playlist' : 'New playlist'}</h3>
          <button type="button" on:click={() => (playlistModalOpen = false)} aria-label="Close"
            >×</button
          >
        </header>
        <div class="modal-body playlist-form">
          <label>
            <span>Name</span>
            <input type="text" bind:value={playlistName} placeholder="Playlist name" />
          </label>
          <label>
            <span>Description</span>
            <textarea rows="3" bind:value={playlistDescription} placeholder="Optional notes"
            ></textarea>
          </label>
          <label>
            <span>Sync mode</span>
            <select bind:value={playlistSyncMode}>
              <option value="synced">Synced</option>
              <option value="grouped">Grouped</option>
              <option value="independent">Independent</option>
            </select>
          </label>
          <label class="checkbox">
            <input type="checkbox" bind:checked={playlistLoop} />
            <span>Loop playlist</span>
          </label>
          <div class="track-selection">
            <h4>Select tracks</h4>
            <div class="track-grid">
              {#each library as track (track.id)}
                <label class="track-option">
                  <input
                    type="checkbox"
                    checked={playlistTrackSelections[track.id] ?? false}
                    on:change={(event) => {
                      const target = event.target as HTMLInputElement;
                      playlistTrackSelections = {
                        ...playlistTrackSelections,
                        [track.id]: target.checked,
                      };
                    }}
                  />
                  <div>
                    <strong>{track.title}</strong>
                    <span>{track.artist ?? '—'} · {formatDuration(track.durationSeconds)}</span>
                  </div>
                </label>
              {/each}
            </div>
          </div>
          {#if playlistError}
            <p class="form-error" role="alert">{playlistError}</p>
          {/if}
        </div>
        <footer>
          <Button variant="ghost" on:click={() => (playlistModalOpen = false)}>Cancel</Button>
          <Button variant="primary" disabled={playlistBusy} on:click={handlePlaylistSubmit}>
            {playlistBusy ? 'Saving…' : playlistEditingId ? 'Save changes' : 'Create playlist'}
          </Button>
        </footer>
      </div>
    </div>
  {/if}
</Card>

<style>
  .loading {
    display: grid;
    gap: var(--spacing-4);
  }

  .error-state {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .compact-overview {
    display: grid;
    gap: var(--spacing-4);
  }

  .overview-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: var(--spacing-3);
  }

  .metric {
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    background: rgba(12, 21, 41, 0.6);
  }

  .metric span {
    display: block;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .metric strong {
    display: block;
    margin-top: 0.4rem;
    font-size: var(--font-size-xl);
  }

  .compact-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-2);
  }

  .compact-list li {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--spacing-3);
    align-items: center;
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: var(--radius-sm);
    padding: var(--spacing-2) var(--spacing-3);
  }

  .device-name {
    font-weight: 600;
  }

  .device-extra {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .audio-layout {
    display: grid;
    gap: var(--spacing-5);
  }

  .banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .banner.success {
    background: rgba(34, 197, 94, 0.12);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .banner.error {
    background: rgba(248, 113, 113, 0.12);
    border-color: rgba(248, 113, 113, 0.4);
  }

  .banner button {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.1rem;
    cursor: pointer;
  }

  .master {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--spacing-4);
    align-items: center;
  }

  .master-controls {
    display: grid;
    gap: var(--spacing-3);
    min-width: min(24rem, 100%);
  }

  .master-summary {
    display: flex;
    gap: var(--spacing-3);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .device-grid header,
  .orchestrator header,
  .library header,
  .playlists header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-3);
  }

  .device-grid .grid {
    display: grid;
    gap: var(--spacing-3);
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  }

  .device-controls {
    display: grid;
    gap: var(--spacing-3);
    width: 100%;
  }

  .device-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    align-items: center;
    font-size: var(--font-size-sm);
  }

  .state {
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-weight: 600;
    font-size: var(--font-size-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .state-playing {
    background: rgba(34, 197, 94, 0.15);
    color: rgb(34, 197, 94);
  }
  .state-paused {
    background: rgba(250, 204, 21, 0.15);
    color: rgb(250, 204, 21);
  }
  .state-buffering {
    background: rgba(251, 191, 36, 0.15);
    color: rgb(251, 191, 36);
  }
  .state-error {
    background: rgba(248, 113, 113, 0.15);
    color: rgb(248, 113, 113);
  }
  .state-idle {
    background: rgba(148, 163, 184, 0.15);
    color: rgba(148, 163, 184, 0.9);
  }

  .position {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }

  .updated {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }

  .device-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .device-sliders {
    display: grid;
    gap: var(--spacing-3);
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: var(--font-size-xs);
    background: rgba(148, 163, 184, 0.12);
  }

  .pill.alert {
    background: rgba(248, 113, 113, 0.18);
    color: var(--color-red-200);
  }

  .pill.success {
    background: rgba(34, 197, 94, 0.18);
    color: rgb(187, 247, 208);
  }

  .pill.warn {
    background: rgba(251, 191, 36, 0.18);
    color: rgb(253, 224, 71);
  }

  .orchestrator-body {
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-md);
    padding: var(--spacing-4);
    display: grid;
    gap: var(--spacing-3);
    background: rgba(12, 21, 41, 0.55);
  }

  .mode-toggle {
    display: inline-flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }

  .mode-content {
    display: grid;
    gap: var(--spacing-3);
  }

  .mode-content label {
    display: grid;
    gap: 0.5rem;
  }

  .mode-content select,
  .playlist-form select,
  .playlist-form textarea,
  .playlist-form input[type='text'],
  .mode-options input[type='number'] {
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: var(--radius-sm);
    padding: 0.45rem 0.6rem;
    color: var(--color-text);
  }

  .mode-options {
    display: grid;
    gap: var(--spacing-2);
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    align-items: end;
  }

  .checkbox {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: var(--font-size-sm);
  }

  .form-error {
    color: var(--color-red-400);
  }

  .orchestrator-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-2);
  }

  .library table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid rgba(148, 163, 184, 0.12);
  }

  .library th,
  .library td {
    padding: 0.75rem;
    text-align: left;
  }

  .library tbody tr:nth-child(even) {
    background: rgba(148, 163, 184, 0.05);
  }

  .library-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .playlist-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-3);
  }

  .playlist-list li {
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    background: rgba(12, 21, 41, 0.55);
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-3);
    flex-wrap: wrap;
  }

  .playlist-meta {
    display: grid;
    gap: 0.3rem;
  }

  .playlist-meta span {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .playlist-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .tags {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }

  .modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(2, 6, 23, 0.8);
    display: grid;
    place-items: center;
    padding: var(--spacing-6);
    z-index: 1000;
  }

  .modal-content {
    background: var(--color-bg-primary);
    border-radius: var(--radius-lg);
    border: 1px solid rgba(148, 163, 184, 0.2);
    width: min(32rem, 100%);
    display: grid;
    grid-template-rows: auto 1fr auto;
    max-height: 90vh;
  }

  .modal-content.wide {
    width: min(46rem, 100%);
  }

  .modal-content header,
  .modal-content footer {
    padding: var(--spacing-4);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-3);
  }

  .modal-content header button {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.2rem;
    cursor: pointer;
  }

  .modal-body {
    padding: var(--spacing-4);
    display: grid;
    gap: var(--spacing-3);
    overflow-y: auto;
  }

  .playlist-form textarea {
    resize: vertical;
  }

  .track-selection {
    display: grid;
    gap: var(--spacing-3);
  }

  .track-grid {
    display: grid;
    gap: var(--spacing-2);
    max-height: 18rem;
    overflow-y: auto;
  }

  .track-option {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--spacing-2);
    align-items: center;
    padding: var(--spacing-2);
    border-radius: var(--radius-sm);
    background: rgba(12, 21, 41, 0.5);
  }

  .track-option strong {
    display: block;
  }

  .muted {
    color: var(--color-text-muted);
  }

  @media (max-width: 900px) {
    .device-grid .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
