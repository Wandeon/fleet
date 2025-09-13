<script lang="ts">
  export let title = '';
  export let onAction: (action:string, payload?:any)=>Promise<void>;
  let volume = 1.0;
</script>

<div class="bg-white border rounded-xl p-3 space-y-3">
  <div class="flex items-center justify-between">
    <h2 class="font-semibold">{title}</h2>
  </div>
  <div class="flex gap-2 flex-wrap">
    <button class="px-3 py-2 border rounded" on:click={()=>onAction('play',{source:'stream'})}>Play Stream</button>
    <button class="px-3 py-2 border rounded" on:click={()=>onAction('play',{source:'file'})}>Play File</button>
    <button class="px-3 py-2 border rounded" on:click={()=>onAction('play',{source:'stop'})}>Stop</button>
  </div>
  <div class="flex items-center gap-2">
    <label class="text-sm">Volume</label>
    <input type="range" min="0" max="2" step="0.05" bind:value={volume} on:change={()=>onAction('volume',{volume:+volume})} />
    <span class="text-sm">{volume}</span>
  </div>
</div>

