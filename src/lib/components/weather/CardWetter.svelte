<script lang="ts">
	import { Droplet, Wind, CloudRain, Clock } from '@lucide/svelte';
	import { createWeatherStore } from '$lib/stores/weather.svelte';

	const weather = createWeatherStore();

	function formatHour(iso: string) {
		const date = new Date(iso);
		const now = new Date();
		if (date.getHours() === now.getHours() && date.getDate() === now.getDate()) {
			return 'Jetzt';
		}
		return date.toLocaleTimeString('de-DE', { hour: 'numeric' }).replace(' Uhr', '');
	}
</script>

<div class="overflow-hidden rounded-3xl border border-navy-800 bg-navy-900 shadow-lg">
	{#if weather.loading && !weather.data}
		<div class="flex h-56 items-center justify-center">
			<div
				class="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"
			></div>
		</div>
	{:else if weather.error}
		<div class="flex h-56 flex-col items-center justify-center gap-2 text-center">
			<p class="text-xs text-rose-400">{weather.error}</p>
			<button
				type="button"
				onclick={() => weather.refresh()}
				class="rounded-full bg-navy-800 px-3 py-1 text-xs text-cream-100/70 hover:text-cream-100"
			>
				Erneut versuchen
			</button>
		</div>
	{:else if weather.data}
		{@const d = weather.data}

		<!-- Standort -->
		<div class="px-5 pt-2 text-center text-sm font-medium tracking-wide text-cream-100/40">
			Friedrich-Mezger-Straße 13, 78234 Engen
		</div>

		<!-- Hero: aktuelle Bedingungen -->
		<div class="flex items-center justify-center gap-3 px-5 pt-2 pb-4">
			<span class="text-6xl leading-none" role="img" aria-label={d.condition}>{d.icon}</span>
			<div class="flex flex-col">
				<div class="text-4xl font-bold text-cream-100">
					{Math.round(d.temperature)}{d.temperatureUnit}
				</div>
				<div class="mt-1 text-sm text-cream-100/60">{d.condition}</div>
				{#if d.today}
					<div class="mt-1 text-xs text-cream-100/40">
						Hoch: {Math.round(d.today.tempMax)}° / Tief: {Math.round(d.today.tempMin)}°
					</div>
				{/if}
			</div>
		</div>

		<!-- Stat-Chips: Regen / Feuchtigkeit / Wind -->
		<div class="grid grid-cols-3 gap-2 px-4 pb-4">
			<div
				class="flex flex-col items-center gap-1 rounded-2xl border border-cream-100/5 bg-navy-950/50 py-3"
			>
				<CloudRain class="h-4 w-4 text-blue-400" />
				<span class="text-sm font-bold text-cream-100">
					{d.isRaining ? `${d.rainAmount} mm` : `${d.today?.rainProbability ?? 0}%`}
				</span>
				<span class="text-[10px] text-cream-100/40">Regen</span>
			</div>
			<div
				class="flex flex-col items-center gap-1 rounded-2xl border border-cream-100/5 bg-navy-950/50 py-3"
			>
				<Droplet class="h-4 w-4 text-blue-300" />
				<span class="text-sm font-bold text-cream-100">{d.humidity}{d.humidityUnit}</span>
				<span class="text-[10px] text-cream-100/40">Feuchtigkeit</span>
			</div>
			<div
				class="flex flex-col items-center gap-1 rounded-2xl border border-cream-100/5 bg-navy-950/50 py-3"
			>
				<Wind class="h-4 w-4 text-amber-400" />
				<span class="text-sm font-bold text-cream-100"
					>{Math.round(d.windSpeed)} {d.windSpeedUnit}</span
				>
				<span class="text-[10px] text-cream-100/40">Wind</span>
			</div>
		</div>

		<!-- Stündliche Vorhersage -->
		{#if d.hourly?.length}
			<div class="border-t border-cream-100/10 bg-navy-950/40 px-4 py-3">
				<!-- Header mit Icon + Titel -->
				<div class="mb-3 flex items-center gap-2 px-1">
					<Clock class="h-3.5 w-3.5 text-cream-100/50" />
					<span class="text-xs font-semibold text-cream-100/70">Stündliche Vorhersage</span>
				</div>

				<!-- Horizontale Stunden-Leiste -->
				<div class="-mx-1 flex scrollbar-none gap-4 overflow-x-auto px-1 pb-1">
					{#each d.hourly as h, i}
						<div class="flex min-w-[38px] flex-col items-center gap-1.5">
							<!-- Temperatur -->
							<span class="text-sm font-semibold text-cream-100">
								{Math.round(h.temperature)}°
							</span>
							<!-- Icon -->
							<span class="text-xl leading-none" role="img" aria-label="Regenwahrscheinlichkeit">{h.icon}</span>
							<!-- Regenwahrscheinlichkeit (nur wenn > 0) -->
							<span class="h-3 text-[10px] font-semibold text-blue-400">
								{h.rainProbability > 0 ? `${h.rainProbability}%` : ''}
							</span>
							<!-- Uhrzeit -->
							<span
								class="text-[11px] {i === 0 ? 'font-semibold text-cream-100' : 'text-cream-100/50'}"
							>
								{formatHour(h.time)}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
