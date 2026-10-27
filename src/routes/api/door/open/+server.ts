// src/routes/api/door/open/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mqttClient, CLIENT_ID } from '$lib/server/mqtt';

export const POST: RequestHandler = async () => {
    try {
        // 1. E-Türöffner (Switch 1) einschalten
        mqttClient.publish(
            'Klingel-Tuer/rpc',
            JSON.stringify({
                id: 2,
                src: CLIENT_ID,
                method: 'Switch.Set',
                params: { id: 1, on: true }
            })
        );

        return json({ success: true, message: 'Türöffner ausgelöst' });
    } catch (err) {
        console.error('❌ Fehler beim Anuern des Türöffners:', err);
        return json({ success: false, error: 'Fehler beim Senden des MQTT-Befehls' }, { status: 500 });
    }
};