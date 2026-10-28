// src/routes/api/door/klingel/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { doorbellState } from '$lib/server/mqtt';

// Speichert die Timer-Referenz global für diesen Prozess
let resetTimer: NodeJS.Timeout | null = null;

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000; // 8 Stunden in Millisekunden

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { aktiv } = body;

        if (typeof aktiv !== 'boolean') {
            return json({ success: false, error: 'Ungültiger Parameter "aktiv"' }, { status: 400 });
        }

        // Zustand im Server-Speicher aktualisieren
        doorbellState.switch0Enabled = aktiv;

        // Alten Timer löschen, falls bereits einer lief
        if (resetTimer) {
            clearTimeout(resetTimer);
            resetTimer = null;
        }

        // Wenn die Klingel DEAKTIVIERT wurde, starte den 8-Stunden-Timer
        if (!aktiv) {
            console.log('🔇 Klingel stummgeschaltet. Starte 8-unden-Timer...');
            
            resetTimer = setTimeout(() => {
                doorbellState.switch0Enabled = true;
                resetTimer = null;
                console.log('⏰ 8 Stunden abgelaufen: Klingel wurde automatisch wieder auf AKTIV gesetzt.');
            }, EIGHT_HOURS_MS);
        } else {
            console.log('🔔 Klingel manuell aktiviert.');
        }

        return json({ success: true, klingelAktiv: doorbellState.switch0Enabled });
    } catch (err) {
        console.error('❌ Fehler beim Ändern des Klingel-Status:', err);
        return json({ success: false, error: 'Ungültiger Request' }, { status: 400 });
    }
};
