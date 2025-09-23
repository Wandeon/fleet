<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import GlobalStatusBar from '$lib/components/GlobalStatusBar.svelte';
  import { apiFetch, API_CONFIG } from '$lib/api';
  import { connectSSE } from '$lib/stores/deviceStates';

  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/operations', label: 'Operations' },
    { href: '/devices', label: 'Devices' },
    { href: '/logs', label: 'Logs' },
    { href: '/about', label: 'About' },
  ];

  let es: EventSource | undefined;
  let health: any = null;
  let healthError: string | null = null;
  let poller: ReturnType<typeof setInterval> | undefined;
  const HEALTH_INTERVAL = 30000;

  async function refreshHealth() {
    try {
      const response = await apiFetch('/health');
      if (!response.ok) {
        throw new Error(`Health check failed (${response.status})`);
      }
      health = await response.json();
      healthError = null;
    } catch (err) {
      healthError = err instanceof Error ? err.message : String(err);
    }
  }

  onMount(() => {
    es = connectSSE();
    refreshHealth();
    poller = setInterval(refreshHealth, HEALTH_INTERVAL);
    return () => {
      es?.close();
      if (poller) clearInterval(poller);
    };
  });

  $: currentPath = $page.url.pathname;

  function navClass(href: string) {
    const active = currentPath === href || (href !== '/' && currentPath.startsWith(href));
    return active
      ? 'px-3 py-2 text-sm font-medium rounded-lg bg-neutral-900 text-white shadow-sm'
      : 'px-3 py-2 text-sm font-medium rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100';
  }
</script>

<svelte:head>
  <script nonce="%sveltekit.nonce%">/* theme init */</script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
    rel="stylesheet"
  />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@3.4.13/dist/tailwind.min.css" />
</svelte:head>

<div class="min-h-screen bg-neutral-50 text-neutral-900" style="font-family: 'Inter', sans-serif;">
  <header class="bg-white border-b sticky top-0 z-30 shadow-sm">
    <div class="max-w-6xl mx-auto px-4 py-3">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex flex-col">
          <span class="text-lg font-semibold tracking-tight">Fleet Control</span>
          <span class="text-xs text-neutral-500">
            API: {API_CONFIG.base || '/api'}{API_CONFIG.bearer ? ' • Authenticated' : ''}
          </span>
        </div>
        <nav class="ml-auto flex flex-wrap gap-2">
          {#each navItems as item}
            <a class={navClass(item.href)} href={item.href}>{item.label}</a>
          {/each}
        </nav>
      </div>
    </div>
    <div class="border-t bg-neutral-50/70">
      <div class="max-w-6xl mx-auto px-4 py-3 space-y-2">
        <GlobalStatusBar {health} />
        {#if healthError}
          <div class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
            Failed to refresh health: {healthError}
          </div>
        {/if}
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-4 py-6 space-y-6">
    <slot />
  </main>

  <footer class="max-w-6xl mx-auto px-4 py-6 text-xs text-neutral-500 border-t">
    <p class="mb-1">Deployment ready – commits to main roll the dashboard automatically.</p>
    <p>Connected to {API_CONFIG.base || '/api'}.</p>
  </footer>
</div>
