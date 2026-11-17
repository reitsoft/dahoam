<!-- routes/geraete/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';
	
	import Viewport from '$lib/components/Viewport.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import CardGeschirrspueler from '$lib/components/geraete/CardGeschirrspueler.svelte';

	let { data }: PageProps = $props();
</script>

<Viewport>

	<AppHeader title="Geräte" />

	<main class="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-3 px-4 pb-3">
		<CardGeschirrspueler initial={data.geschirrspueler} />
	</main>
</Viewport>
