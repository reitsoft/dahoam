<!-- $lib/components/home/CardHaus.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { HausKarte } from '$lib/server/ebus';
	import Droplets from '@lucide/svelte/icons/droplets';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Thermometer from '@lucide/svelte/icons/thermometer';

	let { initial }: { initial: HausKarte } = $props();

	const DUMMY: HausKarte = {
		datenVorhanden: false,
		raumTemp: 21.4,
		aussenTemp: 9.8,
		warmwasserTemp: 48.2,
		pumpeAn: true,
		kompressorAn: false,
		warmwasserAufbereitung: false
	};

	let live = $state<HausKarte | null>(null);
	const aktuell = $derived(live ?? initial);
	// Solange keine echten Heizungsdaten da sind, werden Dummy-Werte angezeigt
	const d = $derived(aktuell.datenVorhanden ? aktuell : DUMMY);

	const fmt = (n: number | null) => (n === null ? '–' : n.toFixed(1));

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
<div class="flex h-full flex-col justify-center gap-4 rounded-3xl border border-navy-800 bg-navy-900 p-3">
	<div class="flex items-center">
		<span class="pl-2 text-xs font-bold tracking-wide text-cream-100/50 uppercase">Haus</span>

		<!-- Heizkreispumpe: Text links, Icon rechts -->
		<span
			class="ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase {d.pumpeAn
				? 'border-orange-500/30 text-orange-500'
				: 'border-cream-100/15 text-cream-100/50'}"
		>
			Heizkreispumpe {d.pumpeAn ? 'an' : 'aus'}
			<RefreshCw class="ml-1 h-4 w-4 stroke-3 {d.pumpeAn ? 'animate-pulse' : ''}" />
		</span>
	</div>

	<div class="grid grid-cols-[1.25fr_1fr] divide-x divide-cream-100/10">
		<!-- Raum- und Außentemperatur: Thermometer pulsiert orange, wenn der Kompressor läuft -->
		<div class="flex items-center gap-3">
			<div
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors {d.kompressorAn
					? 'bg-orange-500/15'
					: 'bg-teal-500/10'}"
			>
				<Thermometer
					class="h-5 w-5 stroke-3 {d.kompressorAn
						? 'animate-pulse text-orange-500'
						: 'text-teal-500'}"
				/>
			</div>
			<div class="min-w-0 flex-1">
	<div class="flex items-baseline gap-3 whitespace-nowrap">
		<span class="text-2xl font-bold text-cream-100">{fmt(d.raumTemp)}°</span>
		<span class="text-[11px] font-semibold text-cream-100/50">{fmt(d.aussenTemp)}° außen</span>
	</div>
</div>
		</div>

		<!-- Warmwasser: Tropfen pulsiert orange, wenn aufgeheizt wird -->
		<div class="flex items-center gap-3 pl-4">
			<div
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors {d.warmwasserAufbereitung
					? 'bg-orange-500/15'
					: 'bg-sky-500/10'}"
			>
				<Droplets
					class="h-5 w-5 stroke-3 {d.warmwasserAufbereitung
						? 'animate-pulse text-orange-500'
						: 'text-sky-400'}"
				/>
			</div>
			<div>
				<div class="text-2xl font-bold text-cream-100">{fmt(d.warmwasserTemp)}°</div>
				
			</div>
		</div>
	</div>
</div>