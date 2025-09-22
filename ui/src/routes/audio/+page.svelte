<script lang="ts">
  import { onMount } from 'svelte';
  import { deviceStates, jobs } from '$lib/stores/deviceStates';
  import {
    getFleetLayout,
    getFleetState,
    postGroup,
    getLibraryFiles,
    uploadFile,
    getPlaylists,
    savePlaylist,
    getKindStatus
  } from '$lib/api';

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
  let loading = true;
  let error: string | null = null;
  let libraryFiles: any[] = [];
  let playlists: any[] = [];
  let uploadProgress = false;
  let volume = 1.0;
  let currentPlaylist: any = null;
  let playlistName = '';
  let selectedFiles: string[] = [];
  let lastJobId: string | null = null;

  onMount(async () => {
    try {
      const [layout, state, files, playlistsData] = await Promise.all([
        getFleetLayout(),
        getFleetState(),
        getLibraryFiles(),
        getPlaylists(),
      ]);

      // Find the audio group
      audioGroup = layout.groups?.find((g: Group) => g.kind === 'audio');

      // Set initial device states
      if (state.states) {
        const stateMap = Object.fromEntries(
          state.states.map((s: any) => [s.deviceId, s.state])
        );
        deviceStates.set(stateMap);
      }

      libraryFiles = files.files || [];
      playlists = playlistsData.playlists || [];
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  async function executeGroupCommand(action: string, body?: any) {
    if (!audioGroup) return;

    try {
      const result = await postGroup('all-audio', action, body);
      if (result.job_id) {
        lastJobId = result.job_id;
      }
    } catch (err) {
      console.error(`Failed to execute ${action}:`, err);
    }
  }

  async function handlePlay(fileId?: string) {
    await executeGroupCommand('play', fileId ? { fileId } : undefined);
  }

  async function handlePause() {
    await executeGroupCommand('pause');
  }

  async function handleStop() {
    await executeGroupCommand('stop');
  }

  async function handleNext() {
    await executeGroupCommand('next');
  }

  async function handlePrevious() {
    await executeGroupCommand('previous');
  }

  async function handleVolumeChange(event: Event) {
    const slider = event.target as HTMLInputElement;
    volume = parseFloat(slider.value) / 100; // Convert 0-200 to 0.0-2.0
    await executeGroupCommand('volume', { value: volume });
  }

  async function handleUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    uploadProgress = true;
    try {
      for (const file of input.files) {
        await uploadFile(file);
      }
      // Refresh library
      const files = await getLibraryFiles();
      libraryFiles = files.files || [];
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      uploadProgress = false;
      input.value = '';
    }
  }

  async function createPlaylist() {
    if (!playlistName.trim() || selectedFiles.length === 0) return;

    try {
      const playlist = {
        name: playlistName,
        items: selectedFiles.map(fileId => ({ fileId }))
      };
      await savePlaylist(playlist);

      // Refresh playlists
      const playlistsData = await getPlaylists();
      playlists = playlistsData.playlists || [];

      // Reset form
      playlistName = '';
      selectedFiles = [];
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  }

  function toggleFileSelection(fileId: string) {
    if (selectedFiles.includes(fileId)) {
      selectedFiles = selectedFiles.filter(id => id !== fileId);
    } else {
      selectedFiles = [...selectedFiles, fileId];
    }
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
    if (state.playing) parts.push('Playing');
    if (state.volume !== undefined) parts.push(`Vol: ${Math.round(state.volume * 100)}%`);
    if (state.position !== undefined) parts.push(`Pos: ${Math.round(state.position)}s`);

    return parts.length > 0 ? parts.join(', ') : 'Idle';
  }
</script>

<div class="space-y-6">
  <header class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Audio Control</h1>
      <p class="text-sm text-neutral-500">Control all audio devices as a group</p>
    </div>
    <div class="text-sm text-neutral-500">
      Status: {getJobStatus()}
    </div>
  </header>

  {#if loading}
    <div class="border rounded-lg bg-white p-4 shadow-sm">Loading...</div>
  {:else if error}
    <div class="border border-rose-200 bg-rose-50 text-rose-700 rounded-lg p-4 shadow-sm">{error}</div>
  {:else if !audioGroup}
    <div class="border rounded-lg bg-white p-4 shadow-sm text-neutral-600">
      No audio group found. Check device configuration.
    </div>
  {:else}
    <!-- Device Status -->
    <div class="bg-white border rounded-lg p-4 shadow-sm">
      <h2 class="text-lg font-semibold mb-3">Audio Devices</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each audioGroup.devices as device}
          <div class="border rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-medium">{device.name}</h3>
              <span class={`px-2 py-1 text-xs rounded-full ${
                getDeviceStatus(device.id) === 'online' ? 'bg-emerald-100 text-emerald-700' :
                getDeviceStatus(device.id) === 'offline' ? 'bg-rose-100 text-rose-700' :
                'bg-neutral-100 text-neutral-600'
              }`} data-testid="audio.sync-badge">
                {getDeviceStatus(device.id)}
              </span>
            </div>
            <p class="text-sm text-neutral-600">{formatDeviceState(device.id)}</p>
          </div>
        {/each}
      </div>
    </div>

    <!-- Playback Controls -->
    <div class="bg-white border rounded-lg p-4 shadow-sm">
      <h2 class="text-lg font-semibold mb-4">Playback Controls</h2>

      <!-- Volume Control -->
      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">Volume: {Math.round(volume * 100)}%</label>
        <input
          type="range"
          min="0"
          max="200"
          value={volume * 100}
          class="w-full"
          data-testid="audio.volume.slider"
          on:input={handleVolumeChange}
        />
      </div>

      <!-- Transport Controls -->
      <div class="flex gap-2 mb-4">
        <button
          class="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"
          data-testid="audio.play"
          on:click={() => handlePlay()}
        >
          Play
        </button>
        <button
          class="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
          data-testid="audio.pause"
          on:click={handlePause}
        >
          Pause
        </button>
        <button
          class="px-4 py-2 bg-rose-500 text-white rounded hover:bg-rose-600"
          data-testid="audio.stop"
          on:click={handleStop}
        >
          Stop
        </button>
        <button
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          data-testid="audio.prev"
          on:click={handlePrevious}
        >
          Previous
        </button>
        <button
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          data-testid="audio.next"
          on:click={handleNext}
        >
          Next
        </button>
      </div>

      <!-- Progress Bar (placeholder) -->
      <div class="w-full bg-neutral-200 rounded-full h-2" data-testid="audio.progress.bar">
        <div class="bg-emerald-500 h-2 rounded-full w-0"></div>
      </div>
    </div>

    <!-- Library Management -->
    <div class="bg-white border rounded-lg p-4 shadow-sm">
      <h2 class="text-lg font-semibold mb-4">Library</h2>

      <!-- Upload -->
      <div class="mb-4">
        <input
          type="file"
          accept="audio/*"
          multiple
          class="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
          data-testid="library.upload"
          on:change={handleUpload}
          disabled={uploadProgress}
        />
        {#if uploadProgress}
          <p class="text-sm text-neutral-500 mt-2">Uploading...</p>
        {/if}
      </div>

      <!-- File List -->
      <div class="space-y-2 max-h-64 overflow-y-auto">
        {#each libraryFiles as file}
          <div class="flex items-center justify-between p-2 border rounded">
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedFiles.includes(file.id)}
                on:change={() => toggleFileSelection(file.id)}
              />
              <span class="text-sm">{file.filename || file.name}</span>
            </div>
            <div class="flex gap-2">
              <button
                class="px-3 py-1 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600"
                data-testid="library.item.{file.filename}.add-to-playlist"
                on:click={() => handlePlay(file.id)}
              >
                Play
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Playlist Management -->
    <div class="bg-white border rounded-lg p-4 shadow-sm">
      <h2 class="text-lg font-semibold mb-4">Playlists</h2>

      <!-- Create Playlist -->
      <div class="mb-4 p-3 border rounded-lg bg-neutral-50">
        <h3 class="font-medium mb-2">Create New Playlist</h3>
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="Playlist name"
            bind:value={playlistName}
            class="flex-1 px-3 py-2 border rounded"
            data-testid="playlist.add-files"
          />
          <button
            class="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50"
            data-testid="playlist.save"
            disabled={!playlistName.trim() || selectedFiles.length === 0}
            on:click={createPlaylist}
          >
            Create ({selectedFiles.length} files)
          </button>
        </div>
      </div>

      <!-- Existing Playlists -->
      <div class="space-y-2">
        {#each playlists as playlist, index}
          <div class="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <h4 class="font-medium">{playlist.name}</h4>
              <p class="text-sm text-neutral-500">{playlist.items?.length || 0} tracks</p>
            </div>
            <button
              class="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
              data-testid="playlist.row.{index}.play"
              on:click={() => handlePlay(playlist.id)}
            >
              Play
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>