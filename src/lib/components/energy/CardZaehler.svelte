<!-- src/lib/components/energy/CardZaehler.svelte -->
<script lang="ts">
	import Zap from '@lucide/svelte/icons/zap';

	let {
		zaehlerstand,
		obis = '1.8.0',
		statusInfo = null,
		activePhases = ['L1', 'L2', 'L3'] as ('L1' | 'L2' | 'L3')[]
	}: {
		zaehlerstand: number | null;
		obis?: string;
		statusInfo?: string | null;
		activePhases?: ('L1' | 'L2' | 'L3')[];
	} = $props();

	// 6-stellig mit führenden Nullen (wie am EasyMeter-LCD), optional mit Nachkommastelle bei Bedarf
	let formattedDigits = $derived.by(() => {
		if (zaehlerstand === null || Number.isNaN(zaehlerstand)) return null;

		const hasDecimal = Math.abs(zaehlerstand % 1) > 0.0001;
		if (hasDecimal) {
			const [intPart, decPart] = zaehlerstand.toFixed(1).split('.');
			return {
				main: intPart.padStart(6, '0'),
				decimal: decPart
			};
		}

		return {
			main: Math.round(zaehlerstand).toString().padStart(6, '0'),
			decimal: null
		};
	});
</script>

<div class="flex h-full flex-col justify-center rounded-2xl bg-navy-900 p-3">
	<div class="flex items-center gap-3.5">
		<div
			class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-500"
		>
			<Zap class="h-6 w-6" />
		</div>

		<div class="min-w-0 flex-1">
			<!-- Header wie in den übrigen Energie-Cards -->
			<div class="mb-1.5 flex items-center justify-between gap-2">
				<span class="text-xs font-semibold tracking-wider text-cream-100/60 uppercase">
					Zählerstand
				</span>
				<span class="font-mono text-[11px] font-medium text-cream-100/45">
					EasyMeter · {obis}
				</span>
			</div>

			<!-- LCD-Display-Anmutung im Dunkel-Theme -->
			<div
				class="rounded-xl border border-cream-100/10 bg-navy-950/80 px-3 py-2 shadow-inner"
			>
				<!-- Obere Display-Zeile: OBIS links, Phasen L1 L2 L3 rechts -->
				<div class="mb-0.5 flex items-center justify-between text-[10px] font-semibold tracking-wider">
					<span class="font-mono text-orange-400/90">{obis}</span>
					<div class="flex items-center gap-1.5 font-mono">
						{#each ['L1', 'L2', 'L3'] as phase (phase)}
							<span
								class={activePhases.includes(phase as 'L1' | 'L2' | 'L3')
									? 'text-cream-100/85'
									: 'text-cream-100/20'}
							>
								{phase}
							</span>
						{/each}
					</div>
				</div>

				<!-- Hauptwert: Führende Nullen gedimmt, aktive Ziffern hell & klar -->
				<div class="flex items-baseline justify-between gap-2">
					<div class="flex items-baseline font-mono tracking-tight tabular-nums">
						{#if formattedDigits}
							{#each formattedDigits.main.split('') as char, i (i)}
								<span
									class="text-2xl leading-none font-bold {char === '0' &&
									formattedDigits.main
										.slice(0, i + 1)
										.match(/^0+$/)
										? 'text-cream-100/25'
										: 'text-cream-100'}"
								>
									{char}
								</span>
							{/each}
							{#if formattedDigits.decimal}
								<span class="mx-0.5 text-lg font-bold text-cream-100/50">,</span>
								<span class="text-lg leading-none font-semibold text-cream-100/80">
									{formattedDigits.decimal}
								</span>
							{/if}
						{:else}
							<span class="text-2xl leading-none font-bold text-cream-100/50">———</span>
						{/if}
					</div>

					<span class="shrink-0 text-sm font-semibold text-cream-200/70">kWh</span>
				</div>

				<!-- Untere Display-Zeile: optionaler Info-/Statuscode wie INFO / E21 -->
				{#if statusInfo}
					<div class="mt-1 flex items-center gap-1.5 border-t border-cream-100/10 pt-1 text-[10px] font-mono">
						<span class="rounded bg-cream-100/10 px-1 py-0.2 font-semibold text-cream-100/70">
							INFO
						</span>
						<span class="truncate text-cream-100/60">{statusInfo}</span>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
