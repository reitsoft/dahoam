<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
import FingerprintPattern from '@lucide/svelte/icons/fingerprint-pattern';

	// Türöffner (Slide to Unlock)
	const TUER_KNOB_GROESSE = 48;
	const TUER_TRACK_PADDING = 6;

	let tuerEntriegelt = $state(false);
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
			// 1. Biometrie-Scan starten (Smartphone öffnet Fingerabdruck/FaceID Dialog)
			const ok = await biometriePruefen();

			if (ok) {
				// 2. Erlaubnis erteilt! Tür entriegeln & MQTT senden
				tuerDragX = tuerMaxDrag;
				tuerEntriegelt = true;

				// Hier deinen MQTT-Aufruf einfügen:
				// mqttClient.publish('shelly/haustuer/command', 'open');

				// Nach 3 Sekunden automatisch zurücksetzen
				setTimeout(() => {
					tuerEntriegelt = false;
					tuerDragX = 0;
				}, 3000);
			} else {
				// Scan abgebrochen -> Slider federt zurück
				tuerDragX = 0;
			}
		} else {
			// Nicht weit genug geschoben -> Slider federt zurück
			tuerDragX = 0;
		}
	}

	// Prüft und führt den Biometrie-Scan auf dem Handy durch
	async function biometriePruefen(): Promise<boolean> {
		// Falls das Gerät/Browser keine Biometrie unterstützt
		if (!window.PublicKeyCredential) {
			alert('Biometrie auf diesem Gerät nicht verfügbar.');
			return false;
		}

		try {
			// Fordert FaceID / Fingerabdruck vom Smartphone an
			await navigator.credentials.get({
				publicKey: {
					challenge: new Uint8Array(32), // Lokale Challenge
					timeout: 60000,
					userVerification: 'required' // Erzwingt den Biometrie-Scan!
				}
			});
			return true; // Scan erfolgreich!
		} catch (err) {
			console.log('Biometrie-Abfrage abgebrochen oder fehlgeschlagen:', err);
			return false; // Nutzer hat abgebrochen oder Scan schlug fehl
		}
	}
</script>

<!-- Haustür Card -->
<div class="flex h-full flex-col justify-center gap-2 rounded-3xl border border-navy-800 bg-navy-900 p-3">
	<div class="flex items-center justify-between">
		<span class="pl-2 text-xs font-bold tracking-wide text-cream-100/50 uppercase">Haustür</span>

		<!-- Biometrie-Indikator Badge -->
		<div
			class="flex items-center gap-1.5 rounded-full bg-cream-100/5 px-2.5 py-1 text-cream-100/40"
		>
			<FingerprintPattern class="h-3.5 w-3.5 text-teal-500" />
			<span class="text-[10px] font-semibold tracking-wider uppercase">Bio-ID</span>
		</div>
	</div>
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
</div>