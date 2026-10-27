<script lang="ts">
    import Check from '@lucide/svelte/icons/check';
    import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
    import FingerprintPattern from '@lucide/svelte/icons/fingerprint-pattern';
    import Bell from '@lucide/svelte/icons/bell';
    import BellOff from '@lucide/svelte/icons/bell-off';

    // Zustand für den Klingel-Switch (true = Klingel an, false = Klingel deaktiviert)
    let klingelAktiv: boolean = $state(true);

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
                // 2. Erlaubnis erteilt! Tür entriegeln & API aufrufen
                tuerDragX = tuerMaxDrag;
                tuerEntriegelt = true;

                try {
                    // API-Route aufrufen, die den E-Türöffner (Switch 1) über MQTT auslöst
                    const response = await fetch('/api/door/open', {
                        method: 'POST'
                    });
                    
                    if (!response.ok) {
                        console.error('Fehler beim Auslösen des Türöffners');
                    }
                } catch (err) {
                    console.error('Netzwerkfehler beim Türöffnen:', err);
                }

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
        if (!window.PublicKeyCredential) {
            alert('Biometrie auf diesem Gerät nicht verfügbar.');
            return false;
        }

        try {
            await navigator.credentials.get({
                publicKey: {
                    challenge: new Uint8Array(32),
                    timeout: 60000,
                    userVerification: 'required'
                }
            });
            return true;
        } catch (err) {
            console.log('Biometrie-Abfrage abgebrochen oder fehlgeschlagen:', err);
            return false;
        }
    }

    // Funktion zum Umschalten der Klingel (sendet optional direkt MQTT State)
    async function toggleKlingel() {
    klingelAktiv = !klingelAktiv;
    await fetch('/api/door/klingel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktiv: klingelAktiv })
    });
}
</script>

<!-- Haustür Card -->
<div class="flex h-full flex-col justify-center gap-3 rounded-3xl border border-navy-800 bg-navy-900 p-3">
    <!-- Kopfzeile mit Titel, Klingel-Switch (oben mittig) und Bio-ID Badge -->
    <div class="flex items-center justify-between px-1">
        <span class="pl-1 text-xs font-bold tracking-wide text-cream-100/50 uppercase">Haustür</span>

        <!-- Klingel-Deaktivierungs-Switch (oben mittig platziert) -->
        <button
            type="button"
            onclick={toggleKlingel}
            class="flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors {klingelAktiv 
                ? 'border-teal-500/30 bg-teal-500/10 text-teal-400' 
                : 'border-orange-500/30 bg-orange-500/10 text-orange-400'}"
            title={klingelAktiv ? 'Klingel ist aktiv (Klick zum Deaktivieren)' : 'Klingel ist stumm (Klick zum Aktivieren)'}
        >
            {#if klingelAktiv}
                <Bell class="h-3.5 w-3.5" />
                <span class="text-[10px] font-semibold tracking-wider uppercase">Klingel ist An</span>
            {:else}
                <BellOff class="h-3.5 w-3.5" />
                <span class="text-[10px] font-semibold tracking-wider uppercase">Klingel ist Aus</span>
            {/if}
        </button>

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
</div>