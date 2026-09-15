<!-- $lib/components/FullscreenViewport.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children, footer }: { children: Snippet; footer?: Snippet } = $props();
</script>

<div class="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden sm:max-w-lg md:max-w-2xl lg:max-w-3xl select-none">
  {@render children()}

  {#if footer}
    <div class="w-full shrink-0">
      {@render footer()}
    </div>
  {/if}
</div>