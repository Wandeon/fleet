<script lang="ts">
  import { deviceStates } from '$lib/stores/deviceStates';
  import { postGroup, getLibraryFiles, uploadFile, getPlaylists } from '$lib/api';

  export let audioGroup: any;

  let volume = 70;
  let libraryFiles: any[] = [];
  let playlists: any[] = [];
  let uploadProgress = false;
  let showLibrary = false;

  async function loadLibraryData() {
    try {
      const [files, playlistsData] = await Promise.all([
        getLibraryFiles(),
        getPlaylists(),
      ]);
      libraryFiles = files.files || [];
      playlists = playlistsData.playlists || [];
    } catch (err) {
      console.error('Failed to load library data:', err);
    }
  }

  async function executeAudioCommand(action: string, body?: any) {
    try {
      await postGroup('all-audio', action, body);
    } catch (err) {
      console.error(`Failed to execute ${action}:`, err);
    }
  }

  async function handlePlay() {
    await executeAudioCommand('play');
  }

  async function handlePause() {
    await executeAudioCommand('pause');
  }

  async function handleStop() {
    await executeAudioCommand('stop');
  }

  async function handleNext() {
    await executeAudioCommand('next');
  }

  async function handlePrevious() {
    await executeAudioCommand('previous');
  }

  async function handleVolumeChange(event: Event) {
    const slider = event.target as HTMLInputElement;
    volume = parseInt(slider.value);
    await executeAudioCommand('volume', { value: volume / 100 });
  }

  async function handlePlayFile(fileId: string) {
    await executeAudioCommand('play', { fileId });
  }

  async function handleUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    uploadProgress = true;
    try {
      for (const file of input.files) {
        await uploadFile(file);
      }
      await loadLibraryData();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      uploadProgress = false;
      input.value = '';
    }
  }

  function getAudioState() {
    if (!audioGroup?.devices?.length) return null;
    return $deviceStates[audioGroup.devices[0].id];
  }

  function toggleLibrary() {
    showLibrary = !showLibrary;
    if (showLibrary && libraryFiles.length === 0) {
      loadLibraryData();
    }
  }

  $: audioState = getAudioState();
  $: nowPlaying = audioState?.current_track || 'Nothing playing';
  $: isPlaying = audioState?.playing || false;
  $: position = audioState?.position || 0;
  $: duration = audioState?.duration || 0;
</script>

<!-- Transport Controls -->
<div class="transport-controls mb-4">
  <button class="salon-btn salon-btn-secondary transport-btn" on:click={handlePrevious}>
    ⏮
  </button>
  <button class="salon-btn {isPlaying ? 'salon-btn-secondary' : 'salon-btn-primary'} transport-btn" on:click={isPlaying ? handlePause : handlePlay}>
    {isPlaying ? '⏸' : '▶'}
  </button>
  <button class="salon-btn salon-btn-secondary transport-btn" on:click={handleNext}>
    ⏭
  </button>
  <button class="salon-btn salon-btn-secondary transport-btn" on:click={handleStop}>
    ⏹
  </button>
</div>

<!-- Now Playing & Progress -->
<div class="mb-4">
  <div class="text-sm opacity-60 mb-2">Now Playing</div>
  <div class="font-medium mb-2">{nowPlaying}</div>
  <div class="progress-container">
    <div class="progress-bar">
      <div class="progress-fill" style="width: {duration > 0 ? (position / duration) * 100 : 0}%"></div>
    </div>
    <div class="flex justify-between text-xs opacity-60 mt-1">
      <span>{Math.floor(position / 60)}:{(position % 60).toString().padStart(2, '0')}</span>
      <span>{Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}</span>
    </div>
  </div>
</div>

<!-- Volume Control -->
<div class="mb-6">
  <label class="text-sm font-medium mb-2 block">Group Volume: {volume}%</label>
  <input
    type="range"
    min="0"
    max="100"
    bind:value={volume}
    class="salon-slider"
    on:input={handleVolumeChange}
  />
</div>

<!-- Library Management -->
<div class="mb-4">
  <button
    class="salon-btn salon-btn-secondary mb-4"
    on:click={toggleLibrary}
  >
    {showLibrary ? 'Hide' : 'Show'} Library
  </button>

  {#if showLibrary}
    <div class="salon-card-compact">
      <!-- Upload -->
      <div class="mb-4">
        <input
          type="file"
          accept="audio/*"
          multiple
          class="salon-input"
          on:change={handleUpload}
          disabled={uploadProgress}
        />
        {#if uploadProgress}
          <p class="text-sm opacity-60 mt-2">Uploading...</p>
        {/if}
      </div>

      <!-- Playlists -->
      {#if playlists.length > 0}
        <div class="mb-4">
          <h4 class="font-medium mb-2">Playlists</h4>
          {#each playlists as playlist}
            <div class="flex items-center justify-between mb-2 p-2 bg-gray-50 rounded">
              <div>
                <div class="font-medium">{playlist.name}</div>
                <div class="text-sm opacity-60">{playlist.items?.length || 0} tracks</div>
              </div>
              <button
                class="salon-btn salon-btn-primary"
                on:click={() => handlePlayFile(playlist.id)}
              >
                Play
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Files -->
      {#if libraryFiles.length > 0}
        <div>
          <h4 class="font-medium mb-2">Files</h4>
          <div style="max-height: 200px; overflow-y: auto;">
            {#each libraryFiles.slice(0, 10) as file}
              <div class="flex items-center justify-between mb-1 p-1">
                <span class="text-sm">{file.filename || file.name}</span>
                <button
                  class="salon-btn salon-btn-primary"
                  style="padding: 4px 8px; font-size: 12px;"
                  on:click={() => handlePlayFile(file.id)}
                >
                  Play
                </button>
              </div>
            {/each}
          </div>
        </div>
      {:else if !uploadProgress}
        <div class="text-center text-sm opacity-60">
          No files yet — upload to start
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Device Status -->
{#if audioGroup?.devices?.length > 0}
  <div class="salon-card-compact">
    <h4 class="font-medium mb-2">Devices</h4>
    {#each audioGroup.devices as device}
      {@const deviceState = $deviceStates[device.id]}
      <div class="flex items-center justify-between mb-2">
        <div>
          <div class="text-sm font-medium">{device.name}</div>
          <div class="text-xs opacity-60">
            {deviceState?.volume !== undefined ? `Vol: ${Math.round(deviceState.volume * 100)}%` : 'No data'}
          </div>
        </div>
        <span class="status-dot {deviceState?.status === 'online' ? 'ready' : 'offline'}"></span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .bg-gray-50 {
    background-color: var(--neutral-100);
  }
</style>