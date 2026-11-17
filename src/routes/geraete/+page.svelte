<!-- routes/geraete/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';
	import Viewport from '$lib/components/Viewport.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import CardGeschirrspueler from '$lib/components/geraete/CardGeschirrspueler.svelte';
	import CardWaesche from '$lib/components/geraete/CardWaesche.svelte';
	import WashingMachine from '@lucide/svelte/icons/washing-machine';
	import Wind from '@lucide/svelte/icons/wind';

	let { data }: PageProps = $props();
</script>

<Viewport>
	<AppHeader title="Geräte" />

	<main class="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 px-4 pb-3">
		<div class="col-span-2">
			<CardGeschirrspueler initial={data.geschirrspueler} />
		</div>
		<CardWaesche
			id="waschmaschine"
			name="Waschmaschine"
			icon={WashingMachine}
			initial={data.waesche.waschmaschine}
		/>
		<CardWaesche id="trockner" name="Trockner" icon={Wind} initial={data.waesche.trockner} />
	</main>
</Viewport>
