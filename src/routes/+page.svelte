<!-- routes/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';
	
	import Viewport from '$lib/components/Viewport.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import CardVerbrauch from '$lib/components/home/CardVerbrauch.svelte';
	import CardHaus from '$lib/components/home/CardHaus.svelte';
	import CardBad from '$lib/components/home/CardBad.svelte';
	import CardKeller from '$lib/components/home/CardKeller.svelte';
	import CardHaustuer from '$lib/components/home/CardHaustuer.svelte';

	let { data }: PageProps = $props();
</script>

<Viewport>

	<AppHeader title="Dahoam is Dahoam" />

	<main class="grid min-h-0 flex-1 grid-rows-[auto_1fr_1.2fr_0.8fr_auto] gap-3 px-4 pb-3">
		<CardVerbrauch strom={data.strom} />
		<CardHaus />
		<CardBad />
		<CardKeller />
		<CardHaustuer />
	</main>
</Viewport>