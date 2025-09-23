<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import { resolve } from '$app/paths';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import type { HealthTile, RoutePath } from '$lib/types';
  import type { PageData } from './$types';

  export let data: PageData;
  const health = data.layout.health;
  const errors = data.layout.errors;
  const events = data.layout.events;
  const isRouteLink = (href: NonNullable<HealthTile['link']>['href']): href is RoutePath => href.startsWith('/');
</script>

<div class="health-page">
  <Card title="Subsystem uptime" subtitle={`Last updated ${new Date(health.updatedAt).toLocaleString()}`}>
    <div class="grid">
      {#each health.metrics as metric (metric.id)}
        <div class="tile">
          <div class="header">
            <h3>{metric.label}</h3>
            <StatusPill status={metric.status} />
          </div>
          <p class="value">{metric.value}</p>
          {#if metric.hint}
            <p class="hint">{metric.hint}</p>
          {/if}
          {#if metric.link}
            {#if isRouteLink(metric.link.href)}
              <a href={resolve(metric.link.href)} class="link" target="_blank" rel="noreferrer">
                {metric.link.label}
              </a>
            {:else}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
              <a href={metric.link.href} class="link" target="_blank" rel="noreferrer">
                {metric.link.label}
              </a>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  </Card>
  <Card title="Recent errors">
    <ul class="timeline">
      {#each errors as item (item.id)}
        <li>
          <div>
            <strong>{item.message}</strong>
            <time>{new Date(item.timestamp).toLocaleString()}</time>
          </div>
          {#if item.actionLabel}
            <span class="chip">{item.actionLabel}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </Card>
  <Card title="Event feed">
    <ul class="timeline">
      {#each events as event (event.id)}
        <li>
          <div>
            <strong>{event.message}</strong>
            <time>{new Date(event.timestamp).toLocaleString()}</time>
          </div>
        </li>
      {/each}
    </ul>
  </Card>
</div>

<style>
  .health-page {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .grid {
    display: grid;
    gap: var(--spacing-3);
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  }

  .tile {
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    background: rgba(11, 23, 45, 0.6);
    display: grid;
    gap: var(--spacing-2);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-2);
  }

  .header h3 {
    margin: 0;
    font-size: var(--font-size-md);
  }

  .value {
    margin: 0;
    font-size: var(--font-size-xl);
  }

  .hint {
    margin: 0;
    color: var(--color-text-muted);
  }

  .link {
    font-size: var(--font-size-xs);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-brand);
  }

  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-3);
  }

  .timeline li {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-2);
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    padding-bottom: var(--spacing-2);
  }

  .timeline strong {
    display: block;
  }

  .timeline time {
    display: block;
    margin-top: 0.25rem;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .chip {
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    background: rgba(56, 189, 248, 0.12);
    font-size: var(--font-size-xs);
  }
</style>
