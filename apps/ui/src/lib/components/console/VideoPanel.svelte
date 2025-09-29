<script lang="ts">
  import VideoModule from '$lib/modules/VideoModule.svelte';

  export let expanded = true;

  const handleRetry = () => {
    window.location.reload();
  };
</script>

<div class="video-panel" class:expanded>
  <h2>Video Control</h2>
  <VideoModule
    variant="compact"
    onRetry={handleRetry}
  />
</div>

<style>
  .video-panel {
    padding: var(--spacing-4);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
  }

  h2 {
    margin-bottom: var(--spacing-4);
    color: var(--color-text);
    font-size: 1.5rem;
    font-weight: 600;
  }
</style>