<!-- src/routes/energy/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';

	import Viewport from '$lib/components/Viewport.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import CardZaehler from '$lib/components/energy/CardZaehler.svelte';
	import CardMonat from '$lib/components/energy/CardMonat.svelte';
	import CardJahr from '$lib/components/energy/CardJahr.svelte';
	import CardStromfluss from '$lib/components/energy/CardStromfluss.svelte';

	let { data }: PageProps = $props();
</script>

<Viewport>
	<AppHeader title="Energie" />

	<main class="grid min-h-0 w-full flex-1 grid-rows-[auto_10rem_11rem_auto] gap-3 px-4 pb-3">
		<CardZaehler zaehlerstand={data.zaehlerstand}/>
		<CardMonat verbrauchProTag={data.verbrauchProTag} verbrauchVormonat={data.verbrauchVormonat} />
		<CardJahr />
		<CardStromfluss />
	</main>
</Viewport>
