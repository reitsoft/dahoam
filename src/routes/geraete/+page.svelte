<!-- src/routes/geraete/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';
	import Viewport from '$lib/components/Viewport.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import CardGeschirrspueler from '$lib/components/geraete/CardGeschirrspueler.svelte';
	import CardWaesche from '$lib/components/geraete/CardWaesche.svelte';
	import waschmaschineBild from '$lib/assets/waschmaschine.svg';
	import trocknerBild from '$lib/assets/trockner.svg';

	let { data }: PageProps = $props();
</script>

<Viewport>
	<AppHeader title="Geräte" />

	<main class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3">
		<CardGeschirrspueler initial={data.geschirrspueler} />
		<CardWaesche
			id="waschmaschine"
			name="Waschmaschine"
			bild={waschmaschineBild}
			initial={data.waesche.waschmaschine}
		/>
		<CardWaesche
			id="trockner"
			name="Trockner"
			bild={trocknerBild}
			initial={data.waesche.trockner}
		/>
	</main>
</Viewport>
