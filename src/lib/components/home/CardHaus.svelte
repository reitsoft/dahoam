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

	// Außentemperatur-Farbe: bis 12 °C Teal, ab 18 °C Orange, dazwischen Mischung
	function aussenFarbe(t: number | null) {
		if (t === null) return undefined;
		const anteil = Math.min(Math.max((t - 12) / 6, 0), 1);
		return `color-mix(in oklch, rgb(232 99 44) ${anteil * 100}%, rgb(27 143 161))`;
	}

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
	<div class="relative flex items-center">
		<span class="pl-2 text-xs font-bold tracking-wide text-cream-100/50 uppercase">Haus</span>

		{#if d.pumpeAn}
			<!-- Heizkreispumpe: mittig in der Titelzeile, nur sichtbar wenn die Pumpe läuft -->
			<span
				class="absolute left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap text-orange-500 uppercase"
			>
				<RefreshCw class="h-3.5 w-3.5 animate-[spin_2s_linear_infinite] stroke-3" />
				Heizkreispumpe an
			</span>
		{/if}

		<!-- Außentemperatur: nur Zahl und Grad -->
<span class="ml-auto pr-2 text-s font-bold text-cream-100/50" style:color={aussenFarbe(d.aussenTemp)}>
	{fmt(d.aussenTemp)}°
</span>
	</div>

	<div class="grid grid-cols-2 divide-x divide-cream-100/10">
		<!-- Raumtemperatur: Thermometer pulsiert orange, wenn der Kompressor läuft -->
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
			<div>
				<div class="text-2xl font-bold text-cream-100">{fmt(d.raumTemp)}°</div>
				<div class="text-xs text-cream-100/50">Temperatur</div>
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
				<div class="text-xs text-cream-100/50">Warmwasser</div>
			</div>
		</div>
	</div>
</div>