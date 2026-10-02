<!-- $lib/components/home/CardHaus.svelte -->
<script lang="ts">
	import Droplets from '@lucide/svelte/icons/droplets';
import Flame from '@lucide/svelte/icons/flame';
import Thermometer from '@lucide/svelte/icons/thermometer';
import WavesHorizontal from '@lucide/svelte/icons/waves-horizontal';

	// Dummy-Daten
	const heizung = { temp: 21.4, an: true };
	const warmwasser = { temp: 48.2, aufbereitung: false };
</script>

<!-- Heizung / Warmwasser -->
<div class="flex h-full flex-col justify-between gap-2 rounded-3xl border border-navy-800 bg-navy-900 p-3">
	<span class="pl-2 text-xs font-bold tracking-wide text-cream-100/50 uppercase">Haus</span>

	<div class="grid grid-cols-2 divide-x divide-cream-100/10">
		<div class="flex items-center gap-3">
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
				<Thermometer class="h-5 w-5 stroke-3 text-teal-500" />
			</div>
			<div>
				<div class="text-2xl font-bold text-cream-100">{heizung.temp.toFixed(1)}°</div>
				<div class="text-xs text-cream-100/50">Temperatur</div>
			</div>
		</div>
		<div class="flex items-center gap-3 pl-4">
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500/10">
				<Droplets class="h-5 w-5 stroke-3 text-sky-400" />
			</div>
			<div>
				<div class="text-2xl font-bold text-cream-100">{warmwasser.temp.toFixed(1)}°</div>
				<div class="text-xs text-cream-100/50">Warmwasser</div>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-2">
		<span
			class="inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-1.5 text-[11px] font-bold tracking-wide uppercase {heizung.an
				? 'border-orange-500/30 text-orange-500'
				: 'border-cream-100/15 text-cream-100/50'}"
		>
			<Flame class="h-4.5 w-4.5 stroke-3 {heizung.an ? 'animate-pulse' : ''}" />
			Heizung {heizung.an ? 'an' : 'aus'}
		</span>
		<span
			class="inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-1.5 text-[11px] font-bold tracking-wide uppercase {warmwasser.aufbereitung
				? 'border-orange-500/30 text-orange-500'
				: 'border-cream-100/15 text-cream-100/50'}"
		>
			<WavesHorizontal
				class="h-4.5 w-4.5 stroke-3 {warmwasser.aufbereitung ? 'animate-pulse' : ''}"
			/>
			Aufwärmen {warmwasser.aufbereitung ? 'an' : 'aus'}
		</span>
	</div>
</div>