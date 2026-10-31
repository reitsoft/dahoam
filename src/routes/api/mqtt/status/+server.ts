// src/routes/api/mqtt/status/+server.ts
import { json } from '@sveltejs/kit';
import { mqttClient } from '$lib/server/mqtt';

export const GET = () =>
	json({ connected: mqttClient.connected }, { headers: { 'cache-control': 'no-store' } });