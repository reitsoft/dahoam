<script lang="ts">
	import type { PageProps } from './$types';

	import Viewport from '$lib/components/Viewport.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import CardStundenplan from '$lib/components/school/CardStundenplan.svelte';
	import CardTermine from '$lib/components/school/CardTermine.svelte';

	let { data }: PageProps = $props();
</script>

<Viewport>
	<AppHeader title="Schule" />

	<main class="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-3 px-4 pb-3">
		<CardStundenplan />
		<CardTermine />
	</main>
</Viewport>
