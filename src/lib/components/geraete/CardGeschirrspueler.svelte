<script lang="ts">
	import { untrack } from 'svelte';
	import WashingMachine from '@lucide/svelte/icons/washing-machine';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Snowflake from '@lucide/svelte/icons/snowflake';

	type GsState = {
		state: string | null;
		program: string | null;
		progress: number | null;
		endsAt: number | null;
		rinseAidLow: boolean;
		saltLow: boolean;
		fertigAm: number | null;
	};

	let { initial }: { initial: GsState } = $props();

	// Der Server ist die einzige Quelle der Wahrheit
	let gs = $state<GsState>(untrack(() => initial));

	const PROGRAMME: Record<string, string> = {
		Eco50: 'Eco 50°',
		Quick45: 'Express 45°',
		Quick65: 'Express 65°',
		Auto1: 'Auto 35-45°',
		Auto2: 'Auto 45-65°',
		Auto3: 'Auto 65-75°',
		Intensiv70: 'Intensiv 70°',
		Glas40: 'Glas 40°',
		GlassCare: 'Glas',
		NightWash: 'Leise',
		PreRinse: 'Vorspülen',
		MachineCare: 'Maschinenpflege',
		Kurz60: 'Kurz 60°'
	};

	const STATUS: Record<string, string> = {
		Inactive: 'Aus',
		Ready: 'Bereit',
		DelayedStart: 'Startet später',
		Pause: 'Pausiert',
		ActionRequired: 'Aktion nötig',
		Aborting: 'Wird abgebrochen',
		Error: 'Fehler'
	};

	const zeit = (ms: number) =>
		new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

	let programm = $derived(gs.program ? (PROGRAMME[gs.program] ?? gs.program) : '');
	let laeuft = $derived(gs.state === 'Run');
	let fertig = $derived(gs.state === 'Finished');
	let prozent = $derived(Math.min(Math.max(Math.round(gs.progress ?? 0), 0), 100));

	let statusText = $derived.by(() => {
		if (laeuft) return gs.endsAt ? `Fertig um ${zeit(gs.endsAt)}` : 'Läuft';
		if (fertig) return gs.fertigAm ? `Fertig seit ${zeit(gs.fertigAm)}` : 'Fertig';
		return gs.state ? (STATUS[gs.state] ?? gs.state) : '–';
	});

	async function sync() {
		try {
			const res = await fetch('/api/geschirrspueler', { cache: 'no-store' });
			if (!res.ok) return;
			gs = await res.json();
		} catch {
			// offline: letzten Zustand behalten
		}
	}

	// Zustand regelmäßig und beim Zurückkehren in die App abgleichen
	$effect(() => {
		const id = setInterval(() => {
			if (!document.hidden) sync();
		}, 20_000);
		const onVisible = () => {
			if (!document.hidden) sync();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>

<!-- Geschirrspüler -->
<div
	class="flex h-full flex-col justify-between gap-2 rounded-3xl border border-navy-800 bg-navy-900 p-3"
>
	<div class="flex items-start justify-between">
		<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
			<WashingMachine class="h-5 w-5 stroke-3 text-teal-500" />
		</div>
		<span class="pt-1 pr-2 text-sm font-bold text-cream-100">{programm}</span>
	</div>

	<div class="flex items-end justify-between px-2">
		<span class="text-xs font-bold tracking-wide text-cream-100/50 uppercase">Geschirrspüler</span>
		<span class="text-sm font-medium text-cream-100">{statusText}</span>
	</div>

	<!-- Fortschritt -->
	<div
		class="h-3 w-full overflow-hidden rounded-full border border-cream-100/10 bg-navy-950"
		role="progressbar"
		aria-valuenow={prozent}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-label="Programmfortschritt"
	>
		<div
			class="h-full rounded-full bg-teal-500 transition-[width] duration-700"
			style="width: {prozent}%;"
		></div>
	</div>

	<div class="flex items-center justify-between px-2">
		<div class="flex items-center gap-2">
			<Sparkles
				class="h-5 w-5 stroke-2 {gs.rinseAidLow ? 'text-orange-500' : 'text-cream-100/30'}"
				aria-label={gs.rinseAidLow ? 'Klarspüler fast leer' : 'Klarspüler ausreichend'}
			/>
			<Snowflake
				class="h-5 w-5 stroke-2 {gs.saltLow ? 'text-orange-500' : 'text-cream-100/30'}"
				aria-label={gs.saltLow ? 'Salz fast leer' : 'Salz ausreichend'}
			/>
		</div>
		<span class="text-xs text-cream-100/50">{laeuft || fertig ? `${prozent}%` : ''}</span>
	</div>
</div>
