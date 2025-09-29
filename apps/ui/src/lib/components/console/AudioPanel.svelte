<script lang="ts">
  import AudioModule from '$lib/modules/AudioModule.svelte';

  export let expanded = true;

  const handleRetry = () => {
    window.location.reload();
  };
</script>

<div class="audio-panel" class:expanded>
  <h2>Audio Control</h2>
  <AudioModule
    variant="compact"
    onRetry={handleRetry}
  />
</div>

<style>
  .audio-panel {
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