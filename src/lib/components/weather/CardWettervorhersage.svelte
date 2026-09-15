<script lang="ts">
	import { CalendarDays } from '@lucide/svelte';
	import { createWeatherStore } from '$lib/stores/weather.svelte';

	const weather = createWeatherStore();

	function formatWochentag(iso: string, index: number) {
		if (index === 0) return 'Morgen';
		return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short' });
	}

	function formatDatum(iso: string) {
		return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
	}
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-navy-800 bg-navy-900 shadow-lg">
	{#if weather.loading && !weather.data}
		<div class="flex h-56 items-center justify-center">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"></div>
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
	{:else if weather.data?.daily?.length}
		{@const days = weather.data.daily}
		{@const maxHigh = Math.max(...days.map((d) => d.tempMax))}
		{@const minLow = Math.min(...days.map((d) => d.tempMin))}

		<!-- Header -->
		<div class="flex items-center gap-2 px-5 pt-2.5 pb-1">
			<CalendarDays class="h-3.5 w-3.5 text-cream-100/50" />
			<span class="text-xs font-semibold text-cream-100/70">5-Tage-Vorhersage</span>
		</div>

		<!-- Tage-Liste -->
		<div class="flex flex-col px-3 pb-2">
			{#each days as day, i}
				{@const range = maxHigh - minLow || 1}
				{@const barStart = ((day.tempMin - minLow) / range) * 100}
				{@const barWidth = ((day.tempMax - day.tempMin) / range) * 100}

				<div
					class="flex items-center gap-2 rounded-2xl px-2 py-2.5 {i === 0
						? 'bg-teal-500/10'
						: ''}"
				>
					<!-- Wochentag -->
					<div class="w-16 shrink-0">
						<div class="text-sm font-semibold text-cream-100">
							{formatWochentag(day.date, i)}
						</div>
						<div class="text-[10px] text-cream-100/40">{formatDatum(day.date)}</div>
					</div>

					<!-- Icon + Regen -->
					<div class="flex w-12 shrink-0 flex-col items-center gap-0.5">
						<span class="text-xl leading-none" role="img" aria-label={day.condition}>
							{day.icon}
						</span>
						{#if day.rainProbability > 0}
							<span class="text-[9px] font-semibold text-blue-400">{day.rainProbability}%</span>
						{/if}
					</div>

					<!-- Temperatur-Range-Bar -->
					<div class="flex flex-1 items-center gap-2">
						<span class="w-8 shrink-0 text-right text-xs text-cream-100/40">
							{Math.round(day.tempMin)}°
						</span>
						<div class="relative h-1.5 flex-1 rounded-full bg-navy-800">
							<div
								class="absolute h-1.5 rounded-full bg-gradient-to-r from-teal-400 to-amber-400"
								style="left: {barStart}%; width: {barWidth}%;"
							></div>
						</div>
						<span class="w-8 shrink-0 text-xs font-semibold text-cream-100">
							{Math.round(day.tempMax)}°
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>