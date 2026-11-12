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
	// Solange keine echten Heizungsdaten da sind, werden Dummy-Werte angezeigt
	const d = $derived(aktuell.datenVorhanden ? aktuell : DUMMY);

	const fmt = (n: number | null, nachkomma = 1) => (n === null ? '–' : n.toFixed(nachkomma));
	const mitEinheit = (n: number | null, einheit: string, nachkomma = 1) =>
		n === null ? '–' : `${n.toFixed(nachkomma)} ${einheit}`;

	// Werte für den Drawer, gruppiert
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

	// ---- Drawer ----
	const SCHLIESS_DISTANZ = 120; // px
	const SCHLIESS_TEMPO = 0.6; // px/ms bei schnellem Wisch

	let offen = $state(false);
	let dragY = $state(0);
	let dragging = $state(false);
	let startY = 0;
	let startZeit = 0;

	function oeffnen() {
		dragY = 0;
		offen = true;
	}

	function schliessen() {
		offen = false;
		dragY = 0;
	}

	function dragStart(e: PointerEvent) {
		dragging = true;
		startY = e.clientY;
		startZeit = e.timeStamp;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function dragMove(e: PointerEvent) {
		if (!dragging) return;
		// Nur nach unten ziehen
		dragY = Math.max(0, e.clientY - startY);
	}

	function dragEnde(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		const tempo = dragY / Math.max(e.timeStamp - startZeit, 1);
		if (dragY > SCHLIESS_DISTANZ || (dragY > 30 && tempo > SCHLIESS_TEMPO)) schliessen();
		else dragY = 0; // zurückfedern
	}

	function taste(e: KeyboardEvent) {
		if (offen && e.key === 'Escape') schliessen();
	}

	// Hängt den Drawer an <body>, damit transformierte/überlaufende Eltern ihn nicht beeinflussen
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}

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

<svelte:window onkeydown={taste} />

<!-- Heizung / Warmwasser -->
<div
	class="flex h-full flex-col justify-center gap-4 rounded-3xl border border-navy-800 bg-navy-900 p-3"
>
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
		<span
			class="ml-auto pr-2 text-sm font-bold text-cream-100/50"
			style:color={aussenFarbe(d.aussenTemp)}
		>
			{fmt(d.aussenTemp)}°
		</span>
	</div>

	<div class="grid grid-cols-2 divide-x divide-cream-100/10">
		<!-- Raumtemperatur: Thermometer pulsiert orange, wenn der Kompressor läuft; Tippen öffnet den Drawer -->
		<div class="flex items-center gap-3">
			<button
				type="button"
				onclick={oeffnen}
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

<!-- Bottom-Drawer (an <body> gehängt) -->
<div use:portal>
	<!-- Hintergrund: Tippen schließt -->
	<button
		type="button"
		tabindex="-1"
		aria-label="Schließen"
		onclick={schliessen}
		class="fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 {offen
			? 'opacity-100'
			: 'pointer-events-none opacity-0'}"
	></button>

	<div
		role="dialog"
		aria-modal="true"
		aria-label="Heizungsdetails"
		aria-hidden={!offen}
		inert={!offen}
		style:transform={offen ? `translateY(${dragY}px)` : 'translateY(100%)'}
		class="fixed inset-x-0 bottom-0 z-[70] flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-cream-100/10 bg-navy-900 shadow-2xl {dragging
			? ''
			: 'transition-transform duration-300 ease-out'}"
	>
		<!-- Griff + Titel: hier wird gewischt -->
		<div
			role="presentation"
			class="shrink-0 cursor-grab touch-none px-4 pt-3 pb-2 select-none active:cursor-grabbing"
			onpointerdown={dragStart}
			onpointermove={dragMove}
			onpointerup={dragEnde}
			onpointercancel={dragEnde}
		>
			<div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-cream-100/20"></div>
			<div class="flex items-center justify-between">
				<span class="text-xs font-bold tracking-wide text-cream-100/50 uppercase">Heizung</span>
				
			</div>
		</div>

		<!-- Inhalt (scrollbar, falls zu hoch) -->
		<div
			class="flex flex-col gap-5 overflow-y-auto overscroll-contain px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
		>
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
		</div>
	</div>
</div>