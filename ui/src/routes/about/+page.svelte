<script lang="ts">
  import { API_CONFIG } from '$lib/api';
</script>

<section class="space-y-4">
  <header>
    <h1 class="text-3xl font-semibold tracking-tight">About this dashboard</h1>
    <p class="text-sm text-neutral-500">
      UI and API live in this repository. Deploy by running the GitOps agent or shipping the Node adapter build.
    </p>
  </header>

  <div class="bg-white border rounded-xl p-4 shadow-sm space-y-2">
    <h2 class="text-lg font-semibold">API connection</h2>
    <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-neutral-600">
      <div>
        <dt class="text-neutral-500">Base URL</dt>
        <dd><code>{API_CONFIG.base || '/api'}</code></dd>
      </div>
      <div>
        <dt class="text-neutral-500">Authentication</dt>
        <dd>{API_CONFIG.bearer ? 'Bearer token configured' : 'Unauthenticated (development mode)'}</dd>
      </div>
    </dl>
  </div>

  <div class="bg-white border rounded-xl p-4 shadow-sm space-y-3">
    <h2 class="text-lg font-semibold">Deployment steps</h2>
    <ol class="list-decimal list-inside text-sm text-neutral-600 space-y-2">
      <li>Run <code>npm install</code> in <code>api/</code> and <code>ui/</code>.</li>
      <li>Seed device metadata: <code>cd api && npm run migrate && npm run generate && npm run seed:yaml</code>.</li>
      <li>Build the UI: <code>cd ui && npm run build</code>. The Node adapter outputs to <code>build/</code>.</li>
      <li>Compose containers using <code>vps/compose.fleet.yml</code> or your GitOps agent to roll out API + UI + reverse proxy.</li>
    </ol>
    <p class="text-xs text-neutral-500">
      Refer to <code>docs/onboarding-ui-guide.md</code> for a full walkthrough of the control plane, device registry, and API integration.
    </p>
  </div>

  <div class="bg-white border rounded-xl p-4 shadow-sm space-y-2">
    <h2 class="text-lg font-semibold">Resources</h2>
    <ul class="list-disc list-inside text-sm text-neutral-600 space-y-1">
      <li><a class="text-emerald-700 hover:underline" href="/logs">Live log console (Loki-backed)</a></li>
      <li>Repository runbook: <code>docs/onboarding-ui-guide.md</code></li>
      <li>Inventory definitions: <code>inventory/device-interfaces.yaml</code></li>
      <li>API worker & poller configuration: <code>docs/runbooks/api-troubleshooting.md</code></li>
    </ul>
  </div>
</section>
