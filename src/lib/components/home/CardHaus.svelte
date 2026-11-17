<!-- $lib/components/home/CardHaus.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { HausKarte } from '$lib/server/ebus';
	import Drawer from '$lib/components/BottomDrawer.svelte';
	import WetterDrawer from '$lib/components/weather/WetterDrawer.svelte';
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
		warmwasserAufbereitung: false,
		vorlaufTemp: 33.5,
		vorlaufSollTemp: 34.0,
		ruecklaufTemp: 29.8,
		spreizung: 3.7,
		raumSollTemp: 21.0,
		verdichterDrehzahl: 0,
		waermeleistungKw: 0,
		leistungsaufnahmeKw: 0,
		cop: null,
		volumenstrom: 820,
		wasserdruck: 1.6
	};

	let live = $state<HausKarte | null>(null);
	const aktuell = $derived(live ?? initial);
	const d = $derived(aktuell.datenVorhanden ? aktuell : DUMMY);

	const fmt = (n: number | null, nachkomma = 1) => (n === null ? '–' : n.toFixed(nachkomma));
	const mitEinheit = (n: number | null, einheit: string, nachkomma = 1) =>
		n === null ? '–' : `${n.toFixed(nachkomma)} ${einheit}`;

	const gruppen = $derived([
		{
			titel: 'Heizkreis',
			werte: [
				{ label: 'Vorlauf', wert: mitEinheit(d.vorlaufTemp, '°C') },
				{ label: 'Vorlauf Soll', wert: mitEinheit(d.vorlaufSollTemp, '°C') },
				{ label: 'Rücklauf', wert: mitEinheit(d.ruecklaufTemp, '°C') },
				{ label: 'Spreizung', wert: mitEinheit(d.spreizung, 'K') },
				{ label: 'Raum Ist', wert: mitEinheit(d.raumTemp, '°C') },
				{ label: 'Raum Soll', wert: mitEinheit(d.raumSollTemp, '°C') }
			]
		},
		{
			titel: 'Wärmepumpe',
			werte: [
				{ label: 'Verdichter', wert: mitEinheit(d.verdichterDrehzahl, '%', 0) },
				{ label: 'COP', wert: fmt(d.cop) },
				{ label: 'Wärmeleistung', wert: mitEinheit(d.waermeleistungKw, 'kW', 2) },
				{ label: 'Stromaufnahme', wert: mitEinheit(d.leistungsaufnahmeKw, 'kW', 2) }
			]
		},
		{
			titel: 'Anlage',
			werte: [
				{ label: 'Volumenstrom', wert: mitEinheit(d.volumenstrom, 'l/h', 0) },
				{ label: 'Wasserdruck', wert: mitEinheit(d.wasserdruck, 'bar', 2) }
			]
		}
	]);

	let heizungOffen = $state(false);
	let wetterOffen = $state(false);

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

<div
	class="flex h-full flex-col justify-center gap-4 rounded-3xl border border-navy-800 bg-navy-900 p-3"
>
	<div class="relative flex items-center justify-between px-1">
		<span class="pl-1 text-xs font-bold tracking-wide text-cream-100/50 uppercase">Haus</span>

		{#if d.pumpeAn}
			<span
				class="absolute left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-orange-500/20 px-2 py-1 text-[10px] font-bold tracking-wide whitespace-nowrap text-orange-400/70 uppercase"
			>
				<RefreshCw class="h-4 w-4 animate-[spin_2s_linear_infinite] stroke-3" />
				Heizkreispumpe an
			</span>
		{/if}

		<!-- Außentemperatur: Tippen öffnet das Wetter -->
		<button
			type="button"
			onclick={() => (wetterOffen = true)}
			aria-label="Wetter anzeigen"
			aria-haspopup="dialog"
			class="flex items-center gap-1.5 rounded-full bg-cream-100/5 px-2.5 py-1 transition-colors active:scale-95 active:bg-cream-100/10"
		>
			<span
				class="text-sm font-semibold tracking-wider uppercase"
				style:color={aussenFarbe(d.aussenTemp)}>{fmt(d.aussenTemp)}°</span
			>
		</button>
	</div>

	<div class="grid grid-cols-2 divide-x divide-cream-100/10">
		<div class="flex items-center gap-3">
			<button
				type="button"
				onclick={() => (heizungOffen = true)}
				aria-label="Heizungsdetails anzeigen"
				aria-haspopup="dialog"
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 {d.kompressorAn
					? 'bg-orange-500/15'
					: 'bg-teal-500/10'}"
			>
				<Thermometer
					class="h-5 w-5 stroke-3 {d.kompressorAn
						? 'animate-pulse text-orange-500'
						: 'text-teal-500'}"
				/>
			</button>
			<div>
				<div class="text-2xl font-bold text-cream-100">{fmt(d.raumTemp)}°</div>
				<div class="text-xs text-cream-100/50">Temperatur</div>
			</div>
		</div>

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

<Drawer bind:open={heizungOffen} title="Heizung">
	{#each gruppen as gruppe (gruppe.titel)}
		<section>
			<h3 class="mb-2 text-[10px] font-bold tracking-wide text-cream-100/40 uppercase">
				{gruppe.titel}
			</h3>
			<dl class="grid grid-cols-2 gap-2">
				{#each gruppe.werte as { label, wert } (label)}
					<div class="rounded-2xl bg-cream-100/5 px-3 py-2">
						<dt class="text-xs text-cream-100/50">{label}</dt>
						<dd class="text-lg font-bold text-cream-100 tabular-nums">{wert}</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/each}
</Drawer>

<WetterDrawer bind:open={wetterOffen} />
