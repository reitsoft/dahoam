<script>
  import { onMount } from 'svelte';

  let { data } = $props();
  let aktuell = $state(null);
  const ebus = $derived(aktuell ?? data.ebus);

  onMount(() => {
    const timer = setInterval(async () => {
      const res = await fetch('/api/ebus');
      if (res.ok) aktuell = await res.json();
    }, 5000);
    return () => clearInterval(timer);
  });
</script>

<pre class="p-4 text-xs text-slate-200">{JSON.stringify(ebus, null, 2)}</pre>