<script lang="ts">
	import { BatteryFull, BatteryLow, CircleCheck, Droplet, TriangleAlert, Thermometer } from '@lucide/svelte';

	import { kondensationsRisiko } from '$lib/utilities/taupunkt';
	import { createWeatherStore } from '$lib/stores/weather.svelte';
	import { sensorStore } from '$lib/stores/sensors.sse.svelte';

	const weatherStore = createWeatherStore();

	let keller = $derived(sensorStore.get('keller'));

	let aussen = $derived({
		temp: weatherStore.data?.temperature ?? null,
		feuchtigkeit: weatherStore.data?.humidity ?? null
	});

	let taupunktStatus = $derived(
		aussen.temp != null && aussen.feuchtigkeit != null && keller?.temperature != null
			? kondensationsRisiko({
					quellTempC: aussen.temp,
					quellFeuchtePercent: aussen.feuchtigkeit,
					oberflaechenTempC: keller.temperature
				})
			: null
	);

	let batteryLow = $derived(keller?.batteryPercent != null && keller.batteryPercent < 15);

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
</script>

<!-- Keller -->
<div class="flex h-full flex-col justify-between gap-2 rounded-3xl border border-navy-800 bg-navy-900 p-3">
	<div class="relative flex items-center">
		<span class="pl-2 text-xs font-bold tracking-wide text-cream-100/50 uppercase">Keller</span>

		{#if taupunktStatus}
			<div
				class="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase
				{taupunktStatus.risiko ? 'bg-orange-500/10 text-orange-400' : 'bg-teal-500/10 text-teal-500'}"
			>
				{#if taupunktStatus.risiko}
					<TriangleAlert class="h-4.5 w-4.5 animate-pulse stroke-2" />
					Nicht lüften!
				{:else}
					<CircleCheck class="h-3.5 w-3.5 stroke-2" />
					Lüften möglich
				{/if}
			</div>
		{/if}

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