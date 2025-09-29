<script lang="ts">
  import CameraModule from '$lib/modules/CameraModule.svelte';

  export let expanded = true;

  const handleRetry = () => {
    window.location.reload();
  };
</script>

<div class="camera-panel" class:expanded>
  <h2>Camera Monitor</h2>
  <CameraModule
    title="Camera Control"
    onRetry={handleRetry}
  />
</div>

<style>
  .camera-panel {
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