<script lang="ts">
  import GlobalStatusBar from '$lib/components/GlobalStatusBar.svelte';
  import OperationPanel from '$lib/components/OperationPanel.svelte';
  import LogConsole from '$lib/components/LogConsole.svelte';

  let health:any = null;
  async function loadHealth(){
    const r = await fetch('/api/health');
    health = await r.json();
  }
  loadHealth();
  setInterval(loadHealth, 30000);

  async function actionAudio(kind: string, payload:any){
    const r = await fetch(`/api/operations/audio/${kind}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    if(!r.ok) alert('Action failed');
  }
</script>

<div class="space-y-4">
  <GlobalStatusBar {health} />

  <div class="grid gap-4 md:grid-cols-2">
    <OperationPanel title="Audio Playback" onAction={actionAudio} />
    <div class="space-y-2">
      <h2 class="font-semibold">System</h2>
      <p class="text-sm text-neutral-600">Restart agent, reload config (coming soon).</n>
    </div>
  </div>

  <LogConsole />
</div>

