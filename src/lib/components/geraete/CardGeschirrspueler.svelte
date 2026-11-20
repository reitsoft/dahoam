<!-- src/lib/components/geraete/CardGeschirrspueler.svelte -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Snowflake from '@lucide/svelte/icons/snowflake';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
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
				: 'Programm aktiv'
			: fertig && gs.fertigAm
				? `Fertig seit ${zeit(gs.fertigAm)} Uhr`
				: 'Keine aktive Zeit'
	);

	// --- Zustands-Icons (Klarspüler, Salz, Tür) mit Tooltip ---------------------------------

	type InfoKey = 'klarspueler' | 'salz' | 'tuer';
	type Ton = 'ok' | 'warn' | 'unbekannt';

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

	function ausserhalb(e: MouseEvent) {
		if (aktiv && iconBereich && !iconBereich.contains(e.target as Node)) aktiv = null;
	}

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

<article
	class="relative flex flex-col gap-3 overflow-hidden rounded-3xl border bg-gradient-to-b from-navy-800/70 via-navy-900 to-navy-950/90 p-3.5 shadow-xl shadow-black/25 transition-colors duration-300 {laeuft
		? 'border-teal-500/30'
		: fertig
			? 'border-cream-100/15'
			: 'border-navy-800'}"
>
	<!-- Dezenter oberer Lichtstreifen bei aktivem Betrieb -->
	{#if laeuft}
		<div
			aria-hidden="true"
			class="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/70 to-transparent"
		></div>
	{/if}

	<div class="flex items-center gap-3.5">
		<!-- Bild-Container mit pulsierendem Glow im Lauf-Zustand -->
		<div
			class="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl border bg-navy-950/80 transition-colors duration-300 {laeuft
				? 'border-teal-500/25'
				: 'border-cream-100/10'}"
		>
			<!-- Pulsierender Glow -->
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-2 rounded-full transition-opacity duration-500 {laeuft
					? 'glow-pulse opacity-100'
					: fertig
						? 'opacity-35'
						: 'opacity-0'}"
				style="background: radial-gradient(circle, rgba(20, 184, 166, 0.36) 0%, rgba(20, 184, 166, 0.12) 48%, transparent 74%); filter: blur(12px);"
			></div>

			<img
				src={bild}
				alt=""
				class="relative z-10 h-26 w-26 object-contain transition-all duration-300 {laeuft
					? 'scale-[1.02] opacity-100 drop-shadow-[0_0_12px_rgba(20,184,166,0.28)]'
					: fertig
						? 'opacity-100'
						: 'opacity-55'}"
			/>
		</div>

		<!-- Status & Infos -->
		<div class="flex min-w-0 flex-1 flex-col justify-between self-stretch py-0.5">
			<div class="flex items-center justify-between gap-2">
				<div class="flex min-w-0 items-center gap-2">
					<span class="truncate text-xs font-bold tracking-wider text-cream-100/55 uppercase">
						Geschirrspüler
					</span>

					{#if laeuft}
						<span
							class="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-400"
						>
							<span class="h-1.5 w-1.5 rounded-full bg-teal-400 glow-dot"></span>
							Aktiv
						</span>
					{:else if fertig}
						<span
							class="inline-flex items-center gap-1 rounded-full border border-cream-100/15 bg-cream-100/5 px-2 py-0.5 text-[11px] font-medium text-cream-100/80"
						>
							<CircleCheck class="h-3 w-3 text-teal-400" />
							Bereit zum Ausräumen
						</span>
					{/if}
				</div>

				<!-- Platzhalter für den späteren BottomDrawer -->
				<button
					type="button"
					onclick={() => onDetails?.()}
					class="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cream-100/55 transition-colors hover:bg-cream-100/10 hover:text-cream-100 focus-visible:outline-2 focus-visible:outline-teal-500"
					aria-label="Details zum Geschirrspüler öffnen"
				>
					<Ellipsis class="h-5 w-5 stroke-2" />
				</button>
			</div>

			<div class="my-auto">
				<div class="flex items-center gap-2">
					<span
						class="text-2xl font-bold tracking-tight {laeuft
							? 'text-teal-400'
							: fertig
								? 'text-cream-100'
								: 'text-cream-100/45'}"
					>
						{statusText}
					</span>
				</div>
				<p class="mt-0.5 truncate text-xs text-cream-100/55">{detail}</p>
			</div>

			<!-- Programm & Prozent -->
			<div class="flex min-h-5 items-baseline justify-between gap-2 text-sm">
				<div class="min-w-0 truncate">
					{#if programm}
						<span class="font-semibold text-cream-100">{programm}</span>
					{:else}
						<span class="text-xs text-cream-100/35">Kein Programm gewählt</span>
					{/if}
				</div>

				{#if laeuft || fertig}
					<span class="shrink-0 font-mono text-xs font-semibold text-cream-100/75">
						{prozent}%
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Programm-Info & Zustands-Icons -->
	<div class="flex items-center justify-between gap-2 border-t border-cream-100/10 pt-2.5">
		<span class="truncate text-xs text-cream-100/50">
			{#if programm && (laeuft || fertig)}
				{programm} · {prozent}%
			{:else if programm}
				{programm}
			{:else}
				Kein aktives Programm
			{/if}
		</span>

		<div class="relative flex shrink-0 gap-2" bind:this={iconBereich}>
			{#each infos as info (info.key)}
				{@const Icon = info.icon}
				<button
					type="button"
					onclick={() => umschalten(info.key)}
					aria-label="{info.label}: {info.status}"
					aria-expanded={aktiv === info.key}
					class="flex h-8 w-8 items-center justify-center rounded-full border bg-navy-950/90 transition-all {aktiv ===
					info.key
						? 'scale-105 border-cream-100/35 bg-navy-800'
						: 'border-cream-100/10 hover:border-cream-100/25'}"
				>
					<Icon class="h-4 w-4 stroke-2 {TON_KLASSE[info.ton]}" />
				</button>
			{/each}

			{#if aktiveInfo}
				<div
					transition:fade={{ duration: 120 }}
					role="status"
					class="absolute right-0 bottom-full z-20 mb-2 rounded-xl border border-cream-100/15 bg-navy-950 px-3 py-1.5 text-xs whitespace-nowrap shadow-xl"
				>
					<span class="font-bold text-cream-100">{aktiveInfo.label}:</span>
					<span class="ml-1 {TON_KLASSE[aktiveInfo.ton]}">{aktiveInfo.status}</span>
				</div>
			{/if}
		</div>
	</div>
</article>

<style>
	@keyframes glowPulse {
		0%,
		100% {
			transform: scale(0.92);
			opacity: 0.55;
		}
		50% {
			transform: scale(1.12);
			opacity: 1;
		}
	}

	@keyframes dotPulse {
		0%,
		100% {
			opacity: 0.55;
			transform: scale(0.9);
		}
		50% {
			opacity: 1;
			transform: scale(1.15);
		}
	}

	.glow-pulse {
		animation: glowPulse 3.2s ease-in-out infinite;
	}

	.glow-dot {
		animation: dotPulse 2.4s ease-in-out infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.glow-pulse,
		.glow-dot {
			animation: none;
		}
	}
</style>
