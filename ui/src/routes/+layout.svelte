<script lang="ts">
  import { onMount } from 'svelte';
  import { connectSSE } from '$lib/stores/deviceStates';

  let es: EventSource | undefined;

  onMount(() => {
    es = connectSSE('/api');
    return () => es?.close();
  });
</script>

<svelte:head>
  <script nonce="%sveltekit.nonce%">/* theme init */</script>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/tailwindcss@3.4.13/dist/tailwind.min.css"
  />
</svelte:head>

<div class="min-h-screen bg-neutral-50 text-neutral-900">
  <header class="p-3 border-b bg-white sticky top-0 z-20">
    <div class="max-w-6xl mx-auto flex items-center gap-4">
      <strong>Fleet Dashboard</strong>
      <nav class="ml-auto flex gap-3 text-sm">
        <a href="/">Home</a>
        <a href="/operations">Operations</a>
        <a href="/about">About</a>
      </nav>
    </div>
  </header>
  <main class="max-w-6xl mx-auto p-3">
    <slot />
  </main>
  <footer class="p-3 text-xs text-neutral-500 max-w-6xl mx-auto">
    Build info available on /about
  </footer>
</div>
