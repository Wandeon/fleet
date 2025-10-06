<script lang="ts">
  import '$lib/design/global.css';
  import Toast from '$lib/components/Toast.svelte';
  import Button from '$lib/components/Button.svelte';
  import { attachEventHandlers, reattachOnNavigation } from '$lib/svelte5-compat';
  import { onMount } from 'svelte';
  import { mainNavigation } from '$lib/nav';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';
  import {
    connectivity,
    moduleStates,
    resetModuleStates,
    setConnectivity,
    setModuleState,
    type ModuleKey,
    type PanelState,
    useMocks,
  } from '$lib/stores/app';
  import type { LayoutData } from '$lib/types';

  export let data: {
    version: string;
    envLabel: string;
    layout: LayoutData | null;
    layoutError: string | null;
    stateError: string | null;
    healthError: string | null;
    connection: { status: 'online' | 'degraded' | 'offline'; latencyMs: number };
    build: { commit: string; version: string };
    lastUpdated: string;
  };

  $: setConnectivity(data.connection.status);
  $: connectivityStatus = $connectivity;
  $: activePath = $page.url.pathname;
  $: moduleStateSnapshot = $moduleStates;
  $: usingMocks = $useMocks;

  const connectionCopy = {
    online: 'Online',
    degraded: 'Degraded',
    offline: 'Offline',
  } as const;

  const stateOptions: PanelState[] = ['success', 'loading', 'empty', 'error'];
  let mockPanelOpen = false;

  $: allowMockPanel = import.meta.env.DEV || usingMocks;

  $: formattedUpdated = new Date(data.lastUpdated).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  function changeModuleState(key: ModuleKey, value: PanelState) {
    setModuleState(key, value);
  }

  // Initialize Svelte 5 compatibility shim for event handlers
  onMount(() => {
    attachEventHandlers();
    reattachOnNavigation();
  });
</script>

<div class={`app-shell ${mockPanelOpen ? 'mock-open' : ''}`}>
  <header class="top-bar">
    <div class="brand">
      <h1>Head Spa Control</h1>
      <span class="version">v{data.version}</span>
    </div>
    <div class="top-actions">
      <span
        class={`env env-${data.envLabel.toLowerCase()}`}
        aria-label={`Environment: ${data.envLabel}`}
      >
        {data.envLabel}
      </span>
      <span class={`connection connection-${connectivityStatus}`}>
        <span class="dot" aria-hidden="true"></span>
        <span>{connectionCopy[connectivityStatus]}</span>
        <small>{data.connection.latencyMs} ms</small>
      </span>
      <span class="updated">Last updated: {formattedUpdated}</span>
      {#if allowMockPanel}
        <Button
          variant="ghost"
          on:click={() => (mockPanelOpen = !mockPanelOpen)}
          aria-pressed={mockPanelOpen}
        >
          {mockPanelOpen ? 'Hide mock states' : 'Mock states'}
        </Button>
      {/if}
    </div>
  </header>

  <nav class="primary-nav" aria-label="Main">
    {#each mainNavigation as item (item.path)}
      <a
        href={resolve(item.path)}
        class:item-active={activePath === item.path}
        aria-current={activePath === item.path ? 'page' : undefined}
        data-sveltekit-reload={item.external ? '' : undefined}
      >
        <span class="icon" aria-hidden="true">{item.icon}</span>
        <span class="label">{item.label}</span>
      </a>
    {/each}
  </nav>

  <main class="layout">
    <slot />
  </main>
</div>

{#if mockPanelOpen && allowMockPanel}
  <aside class="mock-controls" aria-label="Mock state controls">
    <div class="mock-header">
      <h2>Mock module states</h2>
      <Button variant="ghost" on:click={() => (mockPanelOpen = false)}>Close</Button>
    </div>
    <div class="mock-body">
      <label class="toggle">
        <span>Use mocks</span>
        <input
          type="checkbox"
          checked={usingMocks}
          on:change={(event) => useMocks.set(event.currentTarget.checked)}
        />
      </label>
      <div class="state-grid">
        {#each Object.entries(moduleStateSnapshot) as [key, value] (key)}
          <label>
            <span class="state-label">{key}</span>
            <select
              on:change={(event) =>
                changeModuleState(
                  key as ModuleKey,
                  (event.target as HTMLSelectElement).value as PanelState
                )}
            >
              {#each stateOptions as option (option)}
                <option value={option} selected={option === value}>{option}</option>
              {/each}
            </select>
          </label>
        {/each}
      </div>
      <Button variant="secondary" fullWidth on:click={resetModuleStates}>Reset module states</Button
      >
    </div>
  </aside>
{/if}

<Toast />

<style>
  .app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
    padding: var(--spacing-4);
  }

  .top-bar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--spacing-3);
    align-items: center;
  }

  .brand h1 {
    margin: 0;
    font-size: var(--font-size-2xl);
  }

  .brand .version {
    display: inline-block;
    margin-left: var(--spacing-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .top-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    flex-wrap: wrap;
  }

  .env {
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    background: rgba(56, 189, 248, 0.15);
    color: var(--color-brand);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .connection {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(15, 118, 110, 0.12);
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
  }

  .connection .dot {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
    background: var(--color-success);
  }

  .connection.connection-degraded {
    background: rgba(250, 204, 21, 0.16);
  }

  .connection.connection-degraded .dot {
    background: var(--color-warning);
  }

  .connection.connection-offline {
    background: rgba(248, 113, 113, 0.16);
  }

  .connection.connection-offline .dot {
    background: var(--color-error);
  }

  .connection small {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .updated {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .primary-nav {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }

  .primary-nav a {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: 0.5rem 0.85rem;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    color: var(--color-text-muted);
    transition:
      background var(--transition-fast),
      color var(--transition-fast),
      border var(--transition-fast);
  }

  .primary-nav a:hover,
  .primary-nav a:focus-visible {
    background: rgba(56, 189, 248, 0.12);
    color: var(--color-text);
    border-color: rgba(56, 189, 248, 0.25);
  }

  .primary-nav a.item-active {
    background: rgba(56, 189, 248, 0.2);
    color: var(--color-text);
    border-color: rgba(56, 189, 248, 0.35);
  }

  .layout {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
    flex: 1;
  }

  .mock-controls {
    position: fixed;
    top: var(--spacing-4);
    right: var(--spacing-4);
    width: min(22rem, 90vw);
    background: rgba(8, 14, 28, 0.95);
    border-radius: var(--radius-lg);
    border: 1px solid rgba(148, 163, 184, 0.25);
    box-shadow: var(--shadow-lg);
    padding: var(--spacing-4);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    z-index: 1500;
  }

  .mock-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .mock-body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .state-grid {
    display: grid;
    gap: var(--spacing-2);
  }

  .state-grid label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-2);
  }

  .state-grid select {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.25);
    color: var(--color-text);
    padding: 0.35rem 0.5rem;
    border-radius: var(--radius-sm);
  }

  .toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-2);
  }

  @media (max-width: 720px) {
    .app-shell {
      padding: var(--spacing-3);
    }

    .primary-nav {
      overflow-x: auto;
      padding-bottom: 0.5rem;
    }

    .top-bar {
      align-items: flex-start;
    }
  }
</style>
