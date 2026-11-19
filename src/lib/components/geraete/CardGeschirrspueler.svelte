<!-- src/lib/components/geraete/CardGeschirrspueler.svelte -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Snowflake from '@lucide/svelte/icons/snowflake';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import DoorClosed from '@lucide/svelte/icons/door-closed';
	import bild from '$lib/assets/geschirrspueler.svg';

	type GsState = {
		state: string | null;
		program: string | null;
		progress: number | null;
		endsAt: number | null;
		rinseAidLow: boolean;
		saltLow: boolean;
		doorOpen: boolean | null;
		fertigAm: number | null;
	};

	let {
		initial,
		onDetails
	}: {
		initial: GsState;
		onDetails?: () => void; // später: BottomDrawer öffnen
	} = $props();

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
		Aborting: 'Abbruch',
		Error: 'Fehler'
	};

	const zeit = (ms: number) =>
		new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

	let programm = $derived(gs.program ? (PROGRAMME[gs.program] ?? gs.program) : '');
	let laeuft = $derived(gs.state === 'Run');
	let fertig = $derived(gs.state === 'Finished');
	let prozent = $derived(Math.min(Math.max(Math.round(gs.progress ?? 0), 0), 100));

	let statusText = $derived(
		laeuft ? 'Läuft' : fertig ? 'Fertig' : gs.state ? (STATUS[gs.state] ?? gs.state) : '–'
	);
	let detail = $derived(
		laeuft
			? gs.endsAt
				? `Fertig um ${zeit(gs.endsAt)} Uhr`
				: ''
			: fertig && gs.fertigAm
				? `Seit ${zeit(gs.fertigAm)} Uhr`
				: ''
	);

	// --- Zustands-Icons (Klarspüler, Salz, Tür) mit Tooltip ---------------------------------

	type InfoKey = 'klarspueler' | 'salz' | 'tuer';
	type Ton = 'ok' | 'warn' | 'unbekannt';

	// Teal = in Ordnung, Orange = Aufmerksamkeit nötig, gedimmt = unbekannt
	const TON_KLASSE: Record<Ton, string> = {
		ok: 'text-teal-500',
		warn: 'text-orange-500',
		unbekannt: 'text-cream-100/30'
	};

	let infos = $derived([
		{
			key: 'klarspueler' as InfoKey,
			icon: Sparkles,
			label: 'Klarspüler',
			status: gs.rinseAidLow ? 'Fast leer' : 'Füllstand OK',
			ton: (gs.rinseAidLow ? 'warn' : 'ok') as Ton
		},
		{
			key: 'salz' as InfoKey,
			icon: Snowflake,
			label: 'Salz',
			status: gs.saltLow ? 'Fast leer' : 'Füllstand OK',
			ton: (gs.saltLow ? 'warn' : 'ok') as Ton
		},
		{
			key: 'tuer' as InfoKey,
			icon: gs.doorOpen ? DoorOpen : DoorClosed,
			label: 'Tür',
			status: gs.doorOpen === null ? 'Unbekannt' : gs.doorOpen ? 'Offen' : 'Geschlossen',
			ton: (gs.doorOpen === null ? 'unbekannt' : gs.doorOpen ? 'warn' : 'ok') as Ton
		}
	]);

	let aktiv = $state<InfoKey | null>(null);
	let aktiveInfo = $derived(infos.find((i) => i.key === aktiv) ?? null);
	let iconBereich: HTMLElement | undefined;

	function umschalten(key: InfoKey) {
		aktiv = aktiv === key ? null : key;
	}

	// Tippen außerhalb schließt den Tooltip
	function ausserhalb(e: MouseEvent) {
		if (aktiv && iconBereich && !iconBereich.contains(e.target as Node)) aktiv = null;
	}

	// Tooltip blendet sich nach 3 s selbst aus
	$effect(() => {
		if (!aktiv) return;
		const id = setTimeout(() => (aktiv = null), 3000);
		return () => clearTimeout(id);
	});

	// --- Synchronisierung -------------------------------------------------------------------

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

<svelte:window onclick={ausserhalb} />

<div class="flex flex-col gap-3 rounded-3xl border border-navy-800 bg-navy-900 p-4">
	<div class="flex items-stretch gap-4">
		<img
			src={bild}
			alt=""
			class="h-24 w-24 shrink-0 object-contain transition-opacity {laeuft || fertig
				? 'opacity-100'
				: 'opacity-60'}"
		/>

		<div class="flex min-w-0 flex-1 flex-col justify-between">
			<div class="flex items-start justify-between gap-2">
				<span class="pt-1.5 text-xs font-bold tracking-wide text-cream-100/50 uppercase">
					Geschirrspüler
				</span>

				<!-- Platzhalter für den späteren BottomDrawer -->
				<button
					type="button"
					onclick={() => onDetails?.()}
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cream-100/10 bg-navy-950 text-cream-100/50 transition-colors hover:text-cream-100"
					aria-label="Details zum Geschirrspüler öffnen"
				>
					<ChevronUp class="h-5 w-5 stroke-2" />
				</button>
			</div>

			<div>
				<div class="flex items-center gap-2">
					<span
						class="text-3xl font-bold {laeuft
							? 'text-teal-500'
							: fertig
								? 'text-cream-100'
								: 'text-cream-100/40'}"
					>
						{statusText}
					</span>
					{#if fertig}
						<CircleCheck class="h-6 w-6 stroke-2 text-teal-500" aria-label="Fertig" />
					{/if}
				</div>
				<div class="h-5 text-sm text-cream-100/50">{detail}</div>
			</div>
		</div>
	</div>

	<!-- Programm, Zustands-Icons und Fortschritt -->
	<div class="flex flex-col gap-2 px-1">
		<div class="flex items-center justify-between gap-3">
			<div class="min-w-0 truncate text-sm">
				<span class="font-bold text-cream-100">{programm}</span>
				{#if programm && (laeuft || fertig)}
					<span class="text-cream-100/50"> · {prozent}%</span>
				{/if}
			</div>

			<div class="relative flex shrink-0 gap-2" bind:this={iconBereich}>
				{#each infos as info (info.key)}
					{@const Icon = info.icon}
					<button
						type="button"
						onclick={() => umschalten(info.key)}
						aria-label="{info.label}: {info.status}"
						aria-expanded={aktiv === info.key}
						class="flex h-9 w-9 items-center justify-center rounded-full border bg-navy-950 transition-colors {aktiv ===
						info.key
							? 'border-cream-100/30'
							: 'border-cream-100/10'}"
					>
						<Icon class="h-5 w-5 stroke-2 {TON_KLASSE[info.ton]}" />
					</button>
				{/each}

				{#if aktiveInfo}
					<div
						transition:fade={{ duration: 120 }}
						role="status"
						class="absolute right-0 bottom-full z-10 mb-2 rounded-xl border border-cream-100/10 bg-navy-950 px-3 py-1.5 text-xs whitespace-nowrap shadow-lg"
					>
						<span class="font-bold text-cream-100">{aktiveInfo.label}:</span>
						<span class={TON_KLASSE[aktiveInfo.ton]}>{aktiveInfo.status}</span>
					</div>
				{/if}
			</div>
		</div>

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
	</div>
</div>
