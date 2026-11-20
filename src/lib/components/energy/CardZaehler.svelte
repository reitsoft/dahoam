<!-- src/lib/components/energy/CardZaehler.svelte -->
<script lang="ts">
	import Zap from '@lucide/svelte/icons/zap';

	let { zaehlerstand }: { zaehlerstand: number | null } = $props();

	let digits = $derived.by(() => {
		if (zaehlerstand === null || Number.isNaN(zaehlerstand)) {
			return {
				integer: ['—', '—', '—', '—', '—'],
				decimal: '—'
			};
		}

		// 5 Vorkommastellen (mit führenden Nullen) + 1 Nachkommastelle
		const fixed = Math.max(0, zaehlerstand).toFixed(1);
		const [intPart, decPart] = fixed.split('.');

		return {
			integer: intPart.padStart(5, '0').slice(-5).split(''),
			decimal: decPart
		};
	});
</script>

<div class="flex h-full flex-col justify-center rounded-2xl bg-navy-900 p-3">
	<div class="flex items-center gap-4">
		<!-- Blitz-Icon links wie in deinen anderen Cards -->
		<div
			class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-500"
		>
			<Zap class="h-6 w-6" />
		</div>

		<div class="min-w-0 flex-1">
			<!-- Titel oberhalb des Zählwerks 
			<div class="mb-1.5">
				<span class="text-sm font-medium tracking-wide text-cream-100/60 uppercase">
					Zählerstand
				</span>
			</div>
			-->

			<!-- Mechanisches Rollenzählwerk -->
			<div
				class="inline-flex max-w-full items-stretch overflow-hidden rounded-lg border border-cream-100/15 bg-navy-950 shadow-inner"
			>
				<!-- Vorkommastellen (dunkler Rahmen) -->
				<div class="flex items-center gap-1 px-1.5 py-1">
					{#each digits.integer as digit, i (i)}
						<div
							class="relative flex h-8 w-6 items-center justify-center overflow-hidden rounded border border-cream-100/15 bg-gradient-to-b from-black/65 via-navy-900 to-black/65 shadow-inner sm:h-9 sm:w-7"
						>
							<span class="font-mono text-lg font-bold text-cream-100 tabular-nums sm:text-xl">
								{digit}
							</span>
						</div>
					{/each}
				</div>

				<!-- Komma + Nachkommastelle mit Akzent-Hintergrund (orange-500 statt Rot) -->
				<div class="relative flex items-center bg-orange-500/90 py-1 pr-2 pl-2">
					<!-- Komma auf der Trennkante wie im Vorbild -->
					<span
						class="pointer-events-none absolute -left-1.5 bottom-0.5 z-10 text-xl leading-none font-black text-cream-100 select-none"
					>
						,
					</span>

					<!-- Nachkomma-Zahlenrolle mit feiner Teilstrich-Skala rechts -->
					<div
						class="relative flex h-8 w-7 items-center justify-center overflow-hidden rounded border border-black/30 bg-gradient-to-b from-black/70 via-navy-950 to-black/70 shadow-inner sm:h-9 sm:w-8"
					>
						<span class="pr-1.5 font-mono text-lg font-bold text-cream-100 tabular-nums sm:text-xl">
							{digits.decimal}
						</span>

						<!-- Skalenstriche der Nachkommarolle -->
						<div
							class="pointer-events-none absolute inset-y-1 right-0.5 flex flex-col justify-between opacity-65"
						>
							<span class="h-[1px] w-1 bg-cream-100"></span>
							<span class="h-[1px] w-1.5 bg-cream-100"></span>
							<span class="h-[1px] w-1 bg-cream-100"></span>
							<span class="h-[1px] w-2 bg-cream-100"></span>
							<span class="h-[1px] w-1 bg-cream-100"></span>
							<span class="h-[1px] w-1.5 bg-cream-100"></span>
							<span class="h-[1px] w-1 bg-cream-100"></span>
						</div>
					</div>
				</div>

				<!-- Einheit kWh rechts im eigenen Feld -->
				<div
					class="flex items-center justify-center border-l border-cream-100/10 bg-cream-100/15 px-2.5 text-xs font-bold tracking-wide text-cream-100 sm:text-sm"
				>
					kWh
				</div>
			</div>
		</div>
	</div>
</div>
