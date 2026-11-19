<!-- src/lib/components/geraete/CardWaesche.svelte -->
<script lang="ts">
	import { untrack } from 'svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';

	type Status = {
		status: 'BEREIT' | 'LAEUFT' | 'FERTIG';
		startedAt: number | null;
		fertigAm: number | null;
	};

	let {
		id,
		name,
		bild,
		initial,
		verbrauchMonat = null,
		verbrauchVormonat = null,
		onDetails
	}: {
		id: string;
		name: string;
		bild: string;
		initial: Status;
		verbrauchMonat?: number | null; // kWh
		verbrauchVormonat?: number | null; // kWh
		onDetails?: () => void; // später: BottomDrawer öffnen
	} = $props();

	let s = $state<Status>(untrack(() => initial));
	let jetzt = $state(Date.now());

	let laeuft = $derived(s.status === 'LAEUFT');
	let fertig = $derived(s.status === 'FERTIG');

	const zeit = (ms: number) =>
		new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

	const kwh = (v: number | null) => (v == null ? '–' : v.toFixed(1).replace('.', ','));

	let laufzeit = $derived.by(() => {
		if (!laeuft || !s.startedAt) return '';
		const min = Math.max(Math.floor((jetzt - s.startedAt) / 60000), 0);
		const h = Math.floor(min / 60);
		return h > 0 ? `Seit ${h} Std ${min % 60} Min` : `Seit ${min} Min`;
	});

	let statusText = $derived(laeuft ? 'Läuft' : fertig ? 'Fertig' : 'Bereit');
	let detail = $derived(
		laeuft ? laufzeit : fertig && s.fertigAm ? `Seit ${zeit(s.fertigAm)} Uhr` : ''
	);

	async function sync() {
		try {
			const res = await fetch('/api/waesche', { cache: 'no-store' });
			if (!res.ok) return;
			const all = await res.json();
			if (all[id]) s = all[id];
		} catch {
			// offline: letzten Zustand behalten
		}
	}

	$effect(() => {
		const tick = setInterval(() => (jetzt = Date.now()), 30_000);
		const poll = setInterval(() => {
			if (!document.hidden) sync();
		}, 15_000);
		const onVisible = () => {
			if (!document.hidden) {
				jetzt = Date.now();
				sync();
			}
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(tick);
			clearInterval(poll);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>

<div class="flex flex-col gap-2 rounded-3xl border border-navy-800 bg-navy-900 p-3">
	<div class="flex items-stretch gap-3">
		<img
			src={bild}
			alt=""
			class="h-32 w-32 shrink-0 object-contain transition-opacity {laeuft || fertig
				? 'opacity-100'
				: 'opacity-60'}"
		/>

		<div class="flex min-w-0 flex-1 flex-col justify-between">
			<div class="flex items-center justify-between gap-2">
				<span class="text-xs font-bold tracking-wide text-cream-100/50 uppercase">
					{name}
				</span>

				<!-- Platzhalter für den späteren BottomDrawer -->
				<button
					type="button"
					onclick={() => onDetails?.()}
					class="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded text-cream-100/50 transition-colors hover:text-cream-100 focus-visible:outline-2 focus-visible:outline-teal-500"
					aria-label="Details zu {name} öffnen"
				>
					<Ellipsis class="h-5 w-5 stroke-2" />
				</button>
			</div>

			<div>
				<div class="flex items-center gap-2">
					<span
						class="text-2xl font-bold {laeuft
							? 'text-teal-500'
							: fertig
								? 'text-cream-100'
								: 'text-cream-100/40'}"
					>
						{statusText}
					</span>
					{#if fertig}
						<CircleCheck class="h-5 w-5 stroke-2 text-teal-500" aria-label="Fertig" />
					{/if}
				</div>
				<div class="h-4 text-xs text-cream-100/50">{detail}</div>
			</div>
		</div>
	</div>

	<!-- Verbrauch -->
	<div class="grid grid-cols-2 divide-x divide-cream-100/10 rounded-2xl bg-navy-950 py-2">
		<div class="px-3">
			<div class="text-xl font-bold text-cream-100">
				{kwh(verbrauchMonat)}<span class="ml-1 text-xs font-medium text-cream-100/50">kWh</span>
			</div>
			<div class="text-xs text-cream-100/50">Dieser Monat</div>
		</div>
		<div class="px-3">
			<div class="text-xl font-bold text-cream-100">
				{kwh(verbrauchVormonat)}<span class="ml-1 text-xs font-medium text-cream-100/50">kWh</span>
			</div>
			<div class="text-xs text-cream-100/50">Letzter Monat</div>
		</div>
	</div>
</div>
