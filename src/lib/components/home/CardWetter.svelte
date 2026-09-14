<script lang="ts">
	import {
		Thermometer,
		Droplet,
		Wind,
		CloudRain,
		Compass,
		CloudSun,
		RefreshCw
	} from '@lucide/svelte';
	import { createWeatherStore } from './weatherStore'; // Pfad an deinen Store anpassen

	// Store initialisieren
	const weather = createWeatherStore();
</script>

<div class="flex h-full flex-col justify-between gap-3 rounded-3xl border border-navy-800 bg-navy-900 p-4 shadow-lg">
	<!-- Header: Ort/Titel + Refresh Button & Zeit -->
	<div class="flex items-center justify-between pl-1">
		<span class="text-xs font-bold tracking-wide text-cream-100/50 uppercase">
			Wetter Aktuell
		</span>
		<div class="flex items-center gap-2">
			{#if weather.data?.time}
				<span class="text-[10px] text-cream-100/40">
					{new Date(weather.data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr
				</span>
			{/if}
			<button
				type="button"
				onclick={() => weather.refresh()}
				disabled={weather.loading}
				title="Wetterdaten aktualisieren"
				class="rounded-full p-1 text-cream-100/40 transition-colors hover:bg-navy-800 hover:text-cream-100/80 disabled:opacity-50"
			>
				<RefreshCw class="h-3.5 w-3.5 {weather.loading ? 'animate-spin' : ''}" />
			</button>
		</div>
	</div>

	<!-- Status: Ladezustand / Fehler -->
	{#if weather.loading && !weather.data}
		<div class="flex h-32 items-center justify-center">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"></div>
		</div>
	{:else if weather.error}
		<div class="flex h-32 flex-col items-center justify-center text-center">
			<p class="text-xs text-rose-400">{weather.error}</p>
			<button
				type="button"
				onclick={() => weather.refresh()}
				class="mt-2 rounded-full bg-navy-800 px-3 py-1 text-xs text-cream-100/70 hover:text-cream-100"
			>
				Erneut versuchen
			</button>
		</div>
	{:else if weather.data}
		<!-- Haupt-Wetterzustand (Condition + Icon) -->
		<div class="flex items-center justify-between rounded-2xl bg-navy-950/50 px-3 py-2 border border-cream-100/5">
			<div class="flex items-center gap-2.5">
				<span class="text-2xl" role="img" aria-label={weather.data.condition}>
					{weather.data.icon}
				</span>
				<span class="text-sm font-medium text-cream-100">
					{weather.data.condition}
				</span>
			</div>
			<!-- Regen-Badge -->
			{#if weather.data.isRaining}
				<div class="flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
					<CloudRain class="h-3.5 w-3.5 animate-bounce" />
					<span>Regen ({weather.data.rainAmount} mm)</span>
				</div>
			{:else}
				<div class="flex items-center gap-1 text-xs text-cream-100/40">
					<CloudSun class="h-3.5 w-3.5" />
					<span>Trocken</span>
				</div>
			{/if}
		</div>

		<!-- Raster 1: Temperatur & Luftfeuchtigkeit -->
		<div class="grid grid-cols-2 divide-x divide-cream-100/10">
			<!-- Temperatur -->
			<div class="flex items-center gap-3">
				<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
					<Thermometer class="h-5 w-5 stroke-3 text-teal-500" />
				</div>
				<div>
					<div class="text-2xl font-bold text-cream-100">
						{weather.data.temperature.toFixed(1)}{weather.data.temperatureUnit}
					</div>
					<div class="text-xs text-cream-100/50">Temperatur</div>
				</div>
			</div>

			<!-- Feuchtigkeit -->
			<div class="flex items-center gap-3 pl-4">
				<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
					<Droplet class="h-5 w-5 stroke-3 text-blue-400" />
				</div>
				<div>
					<div class="text-2xl font-bold text-cream-100">
						{weather.data.humidity}{weather.data.humidityUnit}
					</div>
					<div class="text-xs text-cream-100/50">Feuchtigkeit</div>
				</div>
			</div>
		</div>

		<!-- Raster 2: Windgeschwindigkeit & Windrichtung -->
		<div class="grid grid-cols-2 divide-x divide-cream-100/10 border-t border-cream-100/10 pt-2">
			<!-- Windstärke -->
			<div class="flex items-center gap-3">
				<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
					<Wind class="h-5 w-5 stroke-3 text-amber-400" />
				</div>
				<div>
					<div class="text-xl font-bold text-cream-100">
						{Math.round(weather.data.windSpeed)} <span class="text-xs font-normal text-cream-100/60">{weather.data.windSpeedUnit}</span>
					</div>
					<div class="text-xs text-cream-100/50">Windstärke</div>
				</div>
			</div>

			<!-- Windrichtung -->
			<div class="flex items-center gap-3 pl-4">
				<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
					<Compass
						class="h-5 w-5 stroke-3 text-purple-400 transition-transform duration-500"
						style="transform: rotate({weather.data.windDirectionDeg}deg);"
					/>
				</div>
				<div>
					<div class="text-xl font-bold text-cream-100">
						{weather.data.windDirectionText}
					</div>
					<div class="text-xs text-cream-100/50">{weather.data.windDirectionDeg}° Wind</div>
				</div>
			</div>
		</div>
	{/if}
</div>
