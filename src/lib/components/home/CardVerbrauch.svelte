<script lang="ts">
	let { strom }: {
		strom: { kwhHeute: number; kostenHeute: string; kwhMonat: number; kostenMonat: string }
	} = $props();
</script>

<!-- Stromverbrauch -->
<div class="flex h-full flex-col justify-center gap-2 rounded-3xl border border-navy-800 bg-navy-900 p-3">
	<span class="pl-2 text-xs font-bold tracking-wide text-cream-100/50 uppercase">Verbrauch</span>

	<div class="grid grid-cols-2 divide-x divide-navy-800">
		<div class="flex items-center gap-3 pr-4 pl-2">
			<div class="flex min-w-0 flex-1 flex-col justify-center">
				<div class="flex items-center gap-1.5">
					<span class="text-2xl leading-tight font-bold text-cream-100">{strom.kwhHeute}</span>
					<span class="text-cream-200 text-sm font-medium">kWh</span>
					<span class="ml-auto rounded-md bg-navy-800 px-2 py-0.5 text-xs font-bold text-cream-100">
						{strom.kostenHeute} €
					</span>
				</div>
				<span class="mt-0.5 truncate text-sm text-cream-100/50">Verbrauch heute</span>
			</div>
		</div>

		<div class="flex items-center pl-4">
			<div class="flex min-w-0 flex-1 flex-col justify-center">
				<div class="flex items-center gap-1.5">
					<span class="text-2xl leading-tight font-bold text-cream-100">{strom.kwhMonat}</span>
					<span class="text-cream-200 text-sm font-medium">kWh</span>
					<span class="ml-auto rounded-md bg-navy-800 px-2 py-0.5 text-xs font-bold text-cream-100">
						{strom.kostenMonat} €
					</span>
				</div>
				<span class="mt-0.5 truncate text-sm text-cream-100/50">Diesen Monat</span>
			</div>
		</div>
	</div>
</div>