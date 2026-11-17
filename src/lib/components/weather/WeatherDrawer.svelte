<script lang="ts">
	import Drawer from '$lib/components/BottomDrawer.svelte';
	import CardWetter from './CardWetter.svelte';
	import CardWettervorhersage from './CardWettervorhersage.svelte';
	import { createWeatherStore } from '$lib/stores/weather.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const weather = createWeatherStore();
</script>

<Drawer bind:open title="Wetter">
	<CardWetter {weather} />
	<CardWettervorhersage {weather} />
</Drawer>
