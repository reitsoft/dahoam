<script lang="ts">
	import { untrack } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
	import FingerprintPattern from '@lucide/svelte/icons/fingerprint-pattern';
	import Bell from '@lucide/svelte/icons/bell';
	import BellOff from '@lucide/svelte/icons/bell-off';
	import { startAuthentication } from '@simplewebauthn/browser';

	// Zustand für den Klingel-Switch (true = Klingel an, false = Klingel deaktiviert)
	let {
		klingelAktivInitial,
		mutedUntilInitial
	}: { klingelAktivInitial: boolean; mutedUntilInitial: number | null } = $props();

	let klingelAktiv = $state(untrack(() => klingelAktivInitial));
	let mutedUntil = $state<number | null>(untrack(() => mutedUntilInitial));
	let klingelBusy = $state(false);
	let klingelFehler = $state('');

	let mutedBisText = $derived(
		mutedUntil
			? new Date(mutedUntil).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
			: ''
	);

	// Türöffner (Slide to Unlock)
	const TUER_KNOB_GROESSE = 48;
	const TUER_TRACK_PADDING = 6;

	let tuerEntriegelt = $state(false);
	let tuerFehler = $state('');
	let tuerTrackBreite = $state(0);
	let tuerDragX = $state(0);
	let tuerDragging = $state(false);
	let tuerPointerStartX = 0;
	let tuerDragStartX = 0;

	let tuerMaxDrag = $derived(
		Math.max(tuerTrackBreite - TUER_KNOB_GROESSE - TUER_TRACK_PADDING * 2, 0)
	);
	let tuerFortschritt = $derived(tuerMaxDrag > 0 ? tuerDragX / tuerMaxDrag : 0);

	function onTuerPointerDown(e: PointerEvent) {
		if (tuerEntriegelt) return;
		tuerDragging = true;
		tuerPointerStartX = e.clientX;
		tuerDragStartX = tuerDragX;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onTuerPointerMove(e: PointerEvent) {
		if (!tuerDragging) return;
		const delta = e.clientX - tuerPointerStartX;
		tuerDragX = Math.min(Math.max(tuerDragStartX + delta, 0), tuerMaxDrag);
	}

	async function onTuerPointerUp() {
		if (!tuerDragging) return;
		tuerDragging = false;

		const schwellenwert = tuerMaxDrag * 0.85; // Zu 85% nach rechts geschoben?

		if (tuerDragX >= schwellenwert) {
			const ok = await entriegeln();
			if (ok) {
				tuerDragX = tuerMaxDrag;
				tuerEntriegelt = true;
				setTimeout(() => {
					tuerEntriegelt = false;
					tuerDragX = 0;
				}, 3000);
			} else {
				tuerDragX = 0;
			}
		}
	}

	async function entriegeln(): Promise<boolean> {
		tuerFehler = '';
		try {
			const ch = await fetch('/api/door/challenge', { method: 'POST' });
			if (!ch.ok) {
				tuerFehler = `Challenge: HTTP ${ch.status}`;
				return false;
			}

			let assertion;
			try {
				assertion = await startAuthentication({ optionsJSON: await ch.json() });
			} catch (e) {
				tuerFehler = `Passkey: ${(e as Error).name} – ${(e as Error).message}`;
				return false;
			}

			const res = await fetch('/api/door/open', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(assertion)
			});
			if (!res.ok) {
				tuerFehler = `Öffnen: HTTP ${res.status}`;
				return false;
			}
			return true;
		} catch (e) {
			tuerFehler = `Netzwerk: ${(e as Error).message}`;
			return false;
		}
	}

	// Funktion zum Umschalten der Klingel (sendet optional direkt MQTT State)
	async function toggleKlingel() {
		if (klingelBusy) return;
		klingelBusy = true;
		klingelFehler = '';
		try {
			const res = await fetch('/api/door/klingel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ aktiv: !klingelAktiv })
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const d = await res.json();
			klingelAktiv = d.klingelAktiv;
			mutedUntil = d.mutedUntil;
		} catch {
			klingelFehler = 'Klingel konnte nicht umgeschaltet werden.';
		} finally {
			klingelBusy = false;
		}
	}

	// Zustand vom Server holen (z. B. nach Ablauf oder Umschalten von einem anderen Gerät)
	async function syncKlingel() {
		if (klingelBusy) return;
		try {
			const res = await fetch('/api/door/klingel', { cache: 'no-store' });
			if (!res.ok) return;
			const d = await res.json();
			klingelAktiv = d.klingelAktiv;
			mutedUntil = d.mutedUntil;
		} catch {
			// offline: alten Zustand behalten
		}
	}

	// Alle 30 s und beim Zurückkehren in die App abgleichen
	$effect(() => {
		const id = setInterval(() => {
			if (!document.hidden) syncKlingel();
		}, 30_000);
		const onVisible = () => {
			if (!document.hidden) syncKlingel();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	// Genau zum Ablaufzeitpunkt nachsehen, ob die Klingel wieder aktiv ist
	$effect(() => {
		if (klingelAktiv || mutedUntil === null) return;
		const rest = Math.max(mutedUntil - Date.now(), 0);
		const id = setTimeout(syncKlingel, rest + 500);
		return () => clearTimeout(id);
	});
</script>

<!-- Haustür Card -->
<div
	class="flex h-full flex-col justify-center gap-3 rounded-3xl border border-navy-800 bg-navy-900 p-3"
>
	<!-- Kopfzeile mit Titel, Klingel-Switch (oben mittig) und Bio-ID Badge -->
	<div class="flex items-center justify-between px-1">
		<span class="pl-1 text-xs font-bold tracking-wide text-cream-100/50 uppercase">Haustür</span>

		<!-- Klingel-Deaktivierungs-Switch (oben mittig platziert) -->
		<button
			type="button"
			onclick={toggleKlingel}
			disabled={klingelBusy}
			class="flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors disabled:opacity-50 {klingelAktiv
				? 'border-teal-500/30 bg-teal-500/10 text-teal-400'
				: 'border-orange-500/30 bg-orange-500/10 text-orange-400'}"
			title={klingelAktiv
				? 'Klingel ist aktiv (Klick: für 8 Stunden stummschalten)'
				: `Klingel ist stumm bis ${mutedBisText} (Klick: wieder aktivieren)`}
		>
			{#if klingelAktiv}
				<Bell class="h-3.5 w-3.5" />
				<span class="text-[10px] font-semibold tracking-wider uppercase">Klingel ist an</span>
			{:else}
				<BellOff class="h-3.5 w-3.5" />
				<span class="text-[10px] font-semibold tracking-wider uppercase"
					>Aus bis {mutedBisText}</span
				>
			{/if}
		</button>
		{#if klingelFehler}
			<p class="px-2 text-xs text-orange-400">{klingelFehler}</p>
		{/if}

		<!-- Biometrie-Indikator Badge -->
		<div
			class="flex items-center gap-1.5 rounded-full bg-cream-100/5 px-2.5 py-1 text-cream-100/40"
		>
			<FingerprintPattern class="h-3.5 w-3.5 text-teal-500" />
			<span class="text-[10px] font-semibold tracking-wider uppercase">Bio-ID</span>
		</div>
	</div>

	<!-- Slider (Slide to Unlock) -->
	<div
		bind:clientWidth={tuerTrackBreite}
		class="relative h-15 w-full overflow-hidden rounded-full border border-cream-100/10 bg-navy-950 p-1.5"
	>
		<div
			class="absolute inset-y-1.5 left-1.5 rounded-full bg-navy-950/15"
			style="width: {tuerDragX + TUER_KNOB_GROESSE / 2}px; transition: {tuerDragging
				? 'none'
				: 'width 200ms ease-out'};"
		></div>

		<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
			<span
				class="text-xs font-bold tracking-wide uppercase {tuerEntriegelt
					? 'text-orange-500'
					: 'text-cream-100/40'}"
				style="opacity: {tuerEntriegelt ? 1 : Math.max(1 - tuerFortschritt * 1.6, 0)};"
			>
				{tuerEntriegelt ? 'Tür entriegelt' : 'Schieben zum Entriegeln'}
			</span>
		</div>

		<button
			type="button"
			aria-label={tuerEntriegelt ? 'Tür ist entriegelt' : 'Zum Entriegeln nach rechts schieben'}
			onpointerdown={onTuerPointerDown}
			onpointermove={onTuerPointerMove}
			onpointerup={onTuerPointerUp}
			onpointercancel={onTuerPointerUp}
			class="absolute inset-y-1.5 left-1.5 z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full {tuerEntriegelt
				? 'bg-teal-500'
				: 'bg-cream-100/10'}"
			style="touch-action: none; transform: translateX({tuerDragX}px); transition: {tuerDragging
				? 'none'
				: 'transform 200ms ease-out'};"
		>
			{#if tuerEntriegelt}
				<Check class="h-6 w-6 stroke-3 text-navy-950" />
			{:else}
				<ChevronsRight class="h-6 w-6 stroke-3 text-cream-100/40" />
			{/if}
		</button>
	</div>
	{#if tuerFehler}
		<p class="px-2 text-xs text-orange-400">{tuerFehler}</p>
	{/if}
</div>
