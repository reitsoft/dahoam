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

	<main class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3 no-scrollbar">
		<CardVerbrauch strom={data.strom} />
		<CardHaus />
		<CardBad />
		<CardKeller />
		<CardHaustuer />
	</main>
</Viewport>