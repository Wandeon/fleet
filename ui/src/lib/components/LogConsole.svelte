<script lang="ts">
  let logs = '';
  async function fetchLogs(){
    const r = await fetch('/api/logs');
    const j = await r.json();
    logs = JSON.stringify(j, null, 2);
  }
  fetchLogs();
</script>

<div class="border rounded-lg overflow-hidden">
  <div class="p-2 border-b bg-white flex items-center justify-between">
    <strong>Troubleshooting Log</strong>
    <button class="text-sm underline" on:click={fetchLogs}>Refresh</button>
  </div>
  <pre class="p-2 text-xs bg-neutral-50">{logs}</pre>
  </div>

