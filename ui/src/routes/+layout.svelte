<script lang="ts">
  import { onMount } from 'svelte';
  import { connectSSE, sseConnected } from '$lib/stores/deviceStates';
  import { page } from '$app/stores';
  import '../app.css';
  import '$lib/theme/legacy.css';

  let es: EventSource | undefined;

  onMount(() => {
    es = connectSSE();
    return () => es?.close();
  });
</script>

<svelte:head>
  <script nonce="%sveltekit.nonce%">/* theme init */</script>
</svelte:head>

<div class="legacy-app">
  <header class="legacy-header">
    <nav class="legacy-nav">
      <h1>
        <a href="/" class="legacy-nav-brand">🚢 Fleet Management 2.0</a>
        <div data-testid="sse.connected" class={`w-2 h-2 rounded-full inline-block ml-2 ${$sseConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} title={$sseConnected ? 'Live updates connected' : 'Live updates disconnected'}></div>
      </h1>
      <ul class="legacy-nav-list">
        <li><a href="/" class:active={$page.url.pathname === '/'} class="legacy-nav-link" data-testid="nav.home">Dashboard</a></li>
        <li><a href="/audio" class:active={$page.url.pathname === '/audio'} class="legacy-nav-link" data-testid="nav.audio">Audio</a></li>
        <li><a href="/video" class:active={$page.url.pathname === '/video'} class="legacy-nav-link" data-testid="nav.video">Video</a></li>
        <li><a href="/cameras" class:active={$page.url.pathname === '/cameras'} class="legacy-nav-link" data-testid="nav.cameras">Cameras</a></li>
        <li><a href="/smart-home" class:active={$page.url.pathname === '/smart-home'} class="legacy-nav-link" data-testid="nav.smart-home">Smart Home</a></li>
        <li><a href="/logs" class:active={$page.url.pathname === '/logs'} class="legacy-nav-link" data-testid="nav.logs">Logs</a></li>
        <li><a href="/about" class:active={$page.url.pathname === '/about'} class="legacy-nav-link" data-testid="nav.about">About</a></li>
      </ul>
    </nav>
  </header>
  <main class="legacy-main">
    <slot />
  </main>
</div>
