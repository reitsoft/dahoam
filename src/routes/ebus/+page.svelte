<!-- routes/ebus/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  let { data } = $props();

  onMount(() => console.table(data.checks.map(({ name, ok, ms, error }) => ({ name, ok, ms, error }))));
</script>

<div class="space-y-2 p-4 text-sm text-slate-200">
  {#each data.checks as c}
    <div>
      {c.ok ? '✅' : '❌'} {c.name} ({c.ms} ms)
      <pre class="text-xs">{JSON.stringify(c.ok ? c.result : c.error, null, 2)}</pre>
    </div>
  {/each}
</div>