<!-- $lib/components/home/CardHaus.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { HausKarte } from '$lib/server/ebus';
	import Droplets from '@lucide/svelte/icons/droplets';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Thermometer from '@lucide/svelte/icons/thermometer';
	import WavesHorizontal from '@lucide/svelte/icons/waves-horizontal';
	import Zap from '@lucide/svelte/icons/zap';

	let { initial }: { initial: HausKarte } = $props();

	let live = $state<HausKarte | null>(null);
	const d = $derived(live ?? initial);

	const fmt = (n: number | null) => (n === null ? '–' : n.toFixed(1));

	const badges = $derived([
		{ label: 'Pumpe', aktiv: d.pumpeAn, icon: RefreshCw },
		{ label: 'Kompressor', aktiv: d.kompressorAn, icon: Zap },
		{ label: 'Warmwasser', aktiv: d.warmwasserAufbereitung, icon: WavesHorizontal }
	]);

	onMount(() => {
		const laden = async () => {
			try {
				const res = await fetch('/api/ebus/haus');
				if (res.ok) live = await res.json();
			} catch {
				// Netzwerkfehler: letzten Stand behalten
			}
		};
		laden();
		const timer = setInterval(laden, 10_000);
		return () => clearInterval(timer);
	});
</script>

<!-- Heizung / Warmwasser -->
<div class="flex h-full flex-col justify-between gap-2 rounded-3xl border border-navy-800 bg-navy-900 p-3">
	<span class="pl-2 text-xs font-bold tracking-wide text-cream-100/50 uppercase">Haus</span>

	<div class="grid grid-cols-[1.25fr_1fr] divide-x divide-cream-100/10">
		<div class="flex items-center gap-3">
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
				<Thermometer class="h-5 w-5 stroke-3 text-teal-500" />
			</div>
			<div>
				<div class="flex items-baseline gap-1.5 whitespace-nowrap">
					<span class="text-2xl font-bold text-cream-100">{fmt(d.raumTemp)}°</span>
					<span class="text-[11px] font-semibold text-cream-100/50">{fmt(d.aussenTemp)}° außen</span>
				</div>
				<div class="text-xs text-cream-100/50">Temperatur</div>
			</div>
		</div>
		<div class="flex items-center gap-3 pl-4">
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500/10">
				<Droplets class="h-5 w-5 stroke-3 text-sky-400" />
			</div>
			<div>
				<div class="text-2xl font-bold text-cream-100">{fmt(d.warmwasserTemp)}°</div>
				<div class="text-xs text-cream-100/50">Warmwasser</div>
			</div>
		</div>
	</div>

	<div class="flex flex-wrap gap-1.5">
		{#each badges as b (b.label)}
			{@const Icon = b.icon}
			<span
				class="inline-flex items-center gap-1 rounded-full border px-2 py-1.5 text-[10px] font-bold tracking-wide uppercase {b.aktiv
					? 'border-orange-500/30 text-orange-500'
					: 'border-cream-100/15 text-cream-100/50'}"
			>
				<Icon class="h-4 w-4 stroke-3 {b.aktiv ? 'animate-pulse' : ''}" />
				{b.label}
			</span>
		{/each}
	</div>
</div>