// src/routes/api/door/klingel/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { doorbellState } from '$lib/server/mqtt';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { aktiv } = body;

        if (typeof aktiv !== 'boolean') {
            return json({ success: false, error: 'Ungültiger Parameter "aktiv"' }, { status: 400 });
        }

        // Zustand im Server-Speicher aktualisieren
        doorbellState.switch0Enabled = aktiv;

        console.log(`🔔 Klingel-Status geändert: ${aktiv ? 'Aktiviert' : 'Deaktiviert (Stumm)'}`);

        return json({ success: true, klingelAktiv: doorbellState.switch0Enabled });
    } catch (err) {
        console.error('❌ Fehler beim Ändern des Klingel-Status:', err);
        return json({ success: false, error: 'Ungültiger Request' }, { status: 400 });
    }
};