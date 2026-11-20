<!-- src/lib/components/energy/CardZaehler.svelte -->
<script lang="ts">
	import Zap from '@lucide/svelte/icons/zap';
	import BottomDrawer from '$lib/components/BottomDrawer.svelte'; // Pfad anpassen
	import type { ZaehlerDaten } from '$lib/server/stromzaehler';

	let {
		zaehlerstand,
		daten = null
	}: {
		zaehlerstand: number | null;
		daten?: ZaehlerDaten | null;
	} = $props();

	let drawerOffen = $state(false);

	function fmt(v: number | null | undefined, stellen: number): string {
		if (v === null || v === undefined || Number.isNaN(v)) return '—';
		return v.toLocaleString('de-DE', {
			minimumFractionDigits: stellen,
			maximumFractionDigits: stellen
		});
	}

	// Zählwerk: 5 Vorkommastellen (mit führenden Nullen) + 1 Nachkommastelle
	let digits = $derived.by(() => {
		if (zaehlerstand === null || Number.isNaN(zaehlerstand)) {
			return { integer: ['—', '—', '—', '—', '—'], decimal: '—' };
		}
		const fixed = Math.max(0, zaehlerstand).toFixed(1);
		const [intPart, decPart] = fixed.split('.');
		return {
			integer: intPart.padStart(5, '0').slice(-5).split(''),
			decimal: decPart
		};
	});

	let spannungen = $derived([
		{ phase: 'L1', wert: daten?.voltageL1 ?? null },
		{ phase: 'L2', wert: daten?.voltageL2 ?? null },
		{ phase: 'L3', wert: daten?.voltageL3 ?? null }
	]);

	// Unsymmetrie = größte Differenz zwischen den Phasenspannungen
	let unsymmetrie = $derived.by(() => {
		const w = spannungen.map((s) => s.wert).filter((v): v is number => v !== null);
		return w.length === 3 ? Math.max(...w) - Math.min(...w) : null;
	});

	let stand = $derived(
		daten?.zeit
			? new Date(daten.zeit).toLocaleTimeString('de-DE', {
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit'
				})
			: '—'
	);
</script>

<div class="flex h-full flex-col justify-center rounded-2xl bg-navy-900 p-3">
	<div class="flex items-center gap-4">
		<!-- Blitz-Icon: öffnet den Drawer -->
		<button
			type="button"
			onclick={() => (drawerOffen = true)}
			aria-label="Zählerdetails öffnen"
			class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-500 transition active:scale-95 active:bg-orange-500/30"
		>
			<Zap class="h-6 w-6" />
		</button>

		<div class="min-w-0 flex-1">
			<!-- Mechanisches Rollenzählwerk -->
			<div
				class="inline-flex max-w-full items-stretch overflow-hidden rounded-lg border border-cream-100/15 bg-navy-950 shadow-inner"
			>
				<!-- Vorkommastellen -->
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

				<!-- Komma + Nachkommastelle -->
				<div class="relative flex items-center bg-orange-500/90 py-1 pr-2 pl-2">
					<span
						class="pointer-events-none absolute -left-1.5 bottom-0.5 z-10 text-xl leading-none font-black text-cream-100 select-none"
					>
						,
					</span>

					<div
						class="relative flex h-8 w-7 items-center justify-center overflow-hidden rounded border border-black/30 bg-gradient-to-b from-black/70 via-navy-950 to-black/70 shadow-inner sm:h-9 sm:w-8"
					>
						<span class="pr-1.5 font-mono text-lg font-bold text-cream-100 tabular-nums sm:text-xl">
							{digits.decimal}
						</span>

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

				<!-- Einheit -->
				<div
					class="flex items-center justify-center border-l border-cream-100/10 bg-cream-100/15 px-2.5 text-xs font-bold tracking-wide text-cream-100 sm:text-sm"
				>
					kWh
				</div>
			</div>
		</div>
	</div>
</div>

<BottomDrawer bind:open={drawerOffen} title="Stromzähler">
	<!-- Zählerstände -->
	<section class="flex flex-col gap-2">
		<h3 class="text-xs font-bold tracking-wide text-cream-100/50 uppercase">Zählerstände</h3>
		<div class="grid grid-cols-2 gap-2">
			<div class="rounded-xl bg-navy-950 p-3">
				<div class="text-xs text-cream-100/50">Bezug</div>
				<div class="font-mono text-lg font-bold text-cream-100 tabular-nums">
					{fmt(daten?.importActive, 3)}
					<span class="text-xs font-normal text-cream-100/50">kWh</span>
				</div>
			</div>
			<div class="rounded-xl bg-navy-950 p-3">
				<div class="text-xs text-cream-100/50">Einspeisung</div>
				<div class="font-mono text-lg font-bold text-cream-100 tabular-nums">
					{fmt(daten?.exportActive, 3)}
					<span class="text-xs font-normal text-cream-100/50">kWh</span>
				</div>
			</div>
		</div>
	</section>

	<!-- Leistung -->
	<section class="flex flex-col gap-2">
		<h3 class="text-xs font-bold tracking-wide text-cream-100/50 uppercase">Leistung</h3>
		<div class="rounded-xl bg-navy-950 p-3">
			<div class="text-xs text-cream-100/50">Aktuell gesamt</div>
			<div class="font-mono text-lg font-bold text-cream-100 tabular-nums">
				{fmt(daten?.power, 0)}
				<span class="text-xs font-normal text-cream-100/50">W</span>
			</div>
		</div>
	</section>

	<!-- Spannungen -->
	<section class="flex flex-col gap-2">
		<h3 class="text-xs font-bold tracking-wide text-cream-100/50 uppercase">Spannung</h3>
		<div class="grid grid-cols-3 gap-2">
			{#each spannungen as s (s.phase)}
				<div class="rounded-xl bg-navy-950 p-3">
					<div class="text-xs text-cream-100/50">{s.phase}</div>
					<div class="font-mono text-lg font-bold text-cream-100 tabular-nums">
						{fmt(s.wert, 1)}
						<span class="text-xs font-normal text-cream-100/50">V</span>
					</div>
				</div>
			{/each}
		</div>
		<p class="text-xs text-cream-100/40">
			Unsymmetrie: {fmt(unsymmetrie, 1)} V
		</p>
	</section>

	<p class="text-center text-xs text-cream-100/40">Stand: {stand}</p>
</BottomDrawer>