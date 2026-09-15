<!-- routes/weather/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';
	
	import Viewport from '$lib/components/Viewport.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import CardWetter from '$lib/components/weather/CardWetter.svelte';
	import CardWettervorhersage from '$lib/components/weather/CardWettervorhersage.svelte';


	let { data }: PageProps = $props();
</script>

<Viewport>

	<AppHeader title="Wetter" />

	<main class="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-3 px-4 pb-3">
        <CardWetter />
        <CardWettervorhersage />
	</main>
</Viewport>