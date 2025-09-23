<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    // Redirect to control page
    goto('/control', { replaceState: true });
  });
</script>

<!-- Redirecting to Control page... -->

