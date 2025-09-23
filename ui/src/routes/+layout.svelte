<script lang="ts">
  import { onMount } from 'svelte';
  import { connectSSE, sseConnected } from '$lib/stores/deviceStates';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import '../app.css';
  import '$lib/theme/salon.css';

  let es: EventSource | undefined;

  onMount(() => {
    // Redirect to control page if on old routes
    if ($page.url.pathname === '/' || $page.url.pathname === '/dashboard') {
      goto('/control', { replaceState: true });
    }

    es = connectSSE();
    return () => es?.close();
  });
</script>

<svelte:head>
  <script nonce="%sveltekit.nonce%">/* theme init */</script>
</svelte:head>

<!-- Salon Mode - Single Page Layout (no traditional nav) -->
<slot />
