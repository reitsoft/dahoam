<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import BatteryFull from '@lucide/svelte/icons/battery-full';
	import BatteryLow from '@lucide/svelte/icons/battery-low';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleHelp from '@lucide/svelte/icons/circle-help';
	import Droplet from '@lucide/svelte/icons/droplet';
	import Thermometer from '@lucide/svelte/icons/thermometer';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';

	import { lueftungsCheck } from '$lib/utilities/taupunkt';
	import { createWeatherStore } from '$lib/stores/weather.svelte';
	import { sensorStore } from '$lib/stores/sensors.sse.svelte';

	const weatherStore = createWeatherStore();

	let keller = $derived(sensorStore.get('keller'));

	let aussen = $derived({
		temp: weatherStore.data?.temperature ?? null,
		feuchtigkeit: weatherStore.data?.humidity ?? null
	});

	// null = unvollständige oder ungültige Daten -> nie "grün" anzeigen
	let lueften = $derived(
		aussen.temp != null &&
			aussen.feuchtigkeit != null &&
			keller?.temperature != null &&
			keller?.humidity != null
			? lueftungsCheck({
					aussenTempC: aussen.temp,
					aussenFeuchte: aussen.feuchtigkeit,
					kellerTempC: keller.temperature,
					kellerFeuchte: keller.humidity
				})
			: null
	);

	let batteryLow = $derived(keller?.batteryPercent != null && keller.batteryPercent <= 10);

	// Darstellung je Status (Badge + Bewertungsbox im Drawer)
	const badge = $derived.by(() => {
		switch (lueften?.status) {
			case 'ok':
				return {
					label: 'Lüften OK',
					titel: 'Außenluft trocknet den Keller',
					text: 'Die Außenluft enthält weniger Wasserdampf als die Kellerluft und kondensiert nicht an der Wand.',
					klasse: 'bg-teal-500/10 text-teal-500',
					icon: CircleCheck,
					pulse: false
				};
			case 'kondensation':
				return {
					label: 'Nicht lüften!',
					titel: 'Kondensation an der Wand',
					text: 'Der Taupunkt der Außenluft liegt zu nah an der Kellertemperatur. Der Wasserdampf kann an der Wand kondensieren.',
					klasse: 'bg-orange-500/10 text-orange-400',
					icon: TriangleAlert,
					pulse: true
				};
			case 'befeuchtend':
				return {
					label: 'Lüften bringt nichts',
					titel: 'Außenluft ist zu feucht',
					text: 'Die Außenluft enthält nicht deutlich weniger Wasserdampf als die Kellerluft. Der Keller wird eher feuchter als trockener.',
					klasse: 'bg-orange-500/10 text-orange-400',
					icon: TriangleAlert,
					pulse: true
				};
			default:
				return {
					label: 'Keine Daten',
					titel: 'Keine Bewertung möglich',
					text: 'Es fehlen gültige Außen- oder Kellerwerte.',
					klasse: 'bg-cream-100/5 text-cream-100/40',
					icon: CircleHelp,
					pulse: false
				};
		}
	});

	// ---------------------------------------------------------------------
	// Detail-Werte für den Drawer
	// ---------------------------------------------------------------------

	function fmt(v: number | null | undefined, einheit: string, stellen = 1): string {
		if (v == null || !Number.isFinite(v)) return '–';
		return `${v.toFixed(stellen)} ${einheit}`.replace('-', '−');
	}

	interface Wert {
		label: string;
		wert: string;
		hinweis?: string;
		warn?: boolean;
	}

	interface Gruppe {
		titel: string;
		spalten: 'grid-cols-2' | 'grid-cols-3';
		werte: Wert[];
	}

	let gruppen = $derived<Gruppe[]>([
		{
			titel: 'Außenluft',
			spalten: 'grid-cols-3',
			werte: [
				{ label: 'Temperatur', wert: fmt(aussen.temp, '°C') },
				{ label: 'Rel. Feuchte', wert: fmt(aussen.feuchtigkeit, '%', 0) },
				{ label: 'Taupunkt', wert: fmt(lueften?.tpAussenC, '°C') }
			]
		},
		{
			titel: 'Kellerluft',
			spalten: 'grid-cols-3',
			werte: [
				{ label: 'Temperatur', wert: fmt(keller?.temperature, '°C') },
				{ label: 'Rel. Feuchte', wert: fmt(keller?.humidity, '%', 0) },
				{ label: 'Taupunkt', wert: fmt(lueften?.tpKellerC, '°C') }
			]
		},
		{
			titel: 'Bilanz',
			spalten: 'grid-cols-2',
			werte: [
				{
					label: 'Wandabstand',
					wert: fmt(lueften?.abstandK, 'K'),
					hinweis: `Kellertemp. − Taupunkt außen, mind. ${fmt(lueften?.sicherheitsabstandK, 'K', 0)}`,
					warn: lueften != null && lueften.abstandK < lueften.sicherheitsabstandK
				},
				{
					label: 'Taupunkt-Gewinn',
					wert: fmt(lueften?.gewinnK, 'K'),
					hinweis: `Taupunkt Keller − außen, mind. ${fmt(lueften?.mindestGewinnK, 'K', 0)}`,
					warn: lueften != null && lueften.gewinnK < lueften.mindestGewinnK
				}
			]
		}
	]);

	// ---------------------------------------------------------------------
	// Batterie-Tooltip
	// ---------------------------------------------------------------------

	let showBatteryTooltip = $state(false);
	let hideTimeout: ReturnType<typeof setTimeout> | undefined;

	function showTooltip() {
		showBatteryTooltip = true;
		clearTimeout(hideTimeout);
		hideTimeout = setTimeout(() => {
			showBatteryTooltip = false;
		}, 5000);
	}

	function hideTooltip() {
		showBatteryTooltip = false;
		clearTimeout(hideTimeout);
	}

	onDestroy(() => clearTimeout(hideTimeout));

	// ---------------------------------------------------------------------
	// Drawer: öffnen, schließen, Wischgeste
	// ---------------------------------------------------------------------

	let offen = $state(false);
	let dragY = $state(0);
	let dragging = $state(false);
	let startY = 0;
	let startZeit = 0;

	let badgeBtn = $state<HTMLButtonElement>();
	let schliessenBtn = $state<HTMLButtonElement>();

	/** Hängt das Element an <body>, damit `fixed` nicht vom Karten-Layout beeinflusst wird. */
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	async function oeffnen() {
		offen = true;
		dragY = 0;
		await tick();
		schliessenBtn?.focus();
	}

	function schliessen() {
		offen = false;
		dragY = 0;
		badgeBtn?.focus();
	}

	function dragStart(e: PointerEvent) {
		dragging = true;
		startY = e.clientY;
		startZeit = e.timeStamp;
		dragY = 0;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function dragMove(e: PointerEvent) {
		if (!dragging) return;
		dragY = Math.max(0, e.clientY - startY);
	}

	function dragEnde(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		const geschwindigkeit = dragY / Math.max(e.timeStamp - startZeit, 1); // px/ms
		if (dragY > 100 || geschwindigkeit > 0.6) {
			schliessen();
		} else {
			dragY = 0;
		}
	}

	// Hintergrund nicht mitscrollen lassen, solange der Drawer offen ist
	$effect(() => {
		if (!offen) return;
		const vorher = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = vorher;
		};
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && offen && schliessen()} />

<!-- Keller -->
<div
	class="flex h-full flex-col justify-between gap-2 rounded-3xl border border-navy-800 bg-navy-900 p-3"
>
	<div class="relative flex items-center">
		<span class="pl-2 text-xs font-bold tracking-wide text-cream-100/50 uppercase">Keller</span>

		<button
			type="button"
			bind:this={badgeBtn}
			onclick={oeffnen}
			aria-haspopup="dialog"
			aria-expanded={offen}
			class="absolute left-1/2 flex h-7 -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold tracking-wide whitespace-nowrap uppercase transition-opacity active:opacity-70 {badge.klasse}"
			title={lueften
				? `Taupunkt außen ${lueften.tpAussenC.toFixed(1)} °C · Keller ${lueften.tpKellerC.toFixed(1)} °C · Wandabstand ${lueften.abstandK.toFixed(1)} K`
				: undefined}
		>
			<badge.icon class="h-4 w-4 shrink-0 stroke-2 {badge.pulse ? 'animate-pulse' : ''}" />
			{badge.label}
		</button>

		{#if keller?.batteryPercent != null}
			<div class="relative ml-auto">
				<button
					type="button"
					onclick={showTooltip}
					onmouseenter={showTooltip}
					onmouseleave={hideTooltip}
					class="flex items-center justify-center"
					aria-label="Batteriestand {keller.batteryPercent}%"
				>
					{#if batteryLow}
						<BatteryLow class="h-5.5 w-8 stroke-2 text-orange-500" />
					{:else}
						<BatteryFull class="h-5.5 w-8 stroke-2 text-cream-100/30" />
					{/if}
				</button>

				{#if showBatteryTooltip}
					<div
						class="absolute top-full right-0 z-10 mt-1.5 rounded-lg bg-navy-950 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-cream-100 shadow-lg"
					>
						{keller.batteryPercent}%
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<div class="grid grid-cols-2 divide-x divide-cream-100/10">
		<div class="flex items-center gap-3">
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
				<Thermometer class="h-5 w-5 stroke-3 text-teal-500" />
			</div>
			<div>
				<div class="text-2xl font-bold text-cream-100">
					{keller?.temperature != null ? keller.temperature.toFixed(1) : '–'}°
				</div>
				<div class="text-xs text-cream-100/50">Temperatur</div>
			</div>
		</div>
		<div class="flex items-center gap-3 pl-4">
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
				<Droplet class="h-5 w-5 stroke-3 text-blue-400" />
			</div>
			<div>
				<div class="text-2xl font-bold text-cream-100">
					{keller?.humidity != null ? keller.humidity : '–'}%
				</div>
				<div class="text-xs text-cream-100/50">Feuchtigkeit</div>
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
		aria-label="Taupunkt-Analyse"
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
				<span class="text-xs font-bold tracking-wide text-cream-100/50 uppercase">
					Taupunkt-Analyse
				</span>
			</div>
		</div>

		<!-- Inhalt (scrollbar, falls zu hoch) -->
		<div
			class="flex flex-col gap-5 overflow-y-auto overscroll-contain px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
		>
			<!-- Bewertung -->
			<div class="flex items-start gap-3 rounded-2xl px-3 py-3 {badge.klasse}">
				<badge.icon class="mt-0.5 h-5 w-5 shrink-0 stroke-2" />
				<div>
					<div class="text-sm font-bold">{badge.titel}</div>
					<p class="mt-0.5 text-xs leading-snug text-cream-100/60">{badge.text}</p>
				</div>
			</div>

			{#each gruppen as gruppe (gruppe.titel)}
				<section>
					<h3 class="mb-2 text-[10px] font-bold tracking-wide text-cream-100/40 uppercase">
						{gruppe.titel}
					</h3>
					<dl class="grid gap-2 {gruppe.spalten}">
						{#each gruppe.werte as { label, wert, hinweis, warn } (label)}
							<div class="rounded-2xl bg-cream-100/5 px-3 py-2">
								<dt class="text-xs text-cream-100/50">{label}</dt>
								<dd
									class="text-lg font-bold tabular-nums {warn
										? 'text-orange-400'
										: 'text-cream-100'}"
								>
									{wert}
								</dd>
								{#if hinweis}
									<div class="mt-0.5 text-[10px] leading-snug text-cream-100/40">{hinweis}</div>
								{/if}
							</div>
						{/each}
					</dl>
				</section>
			{/each}

			
		</div>
	</div>
</div>