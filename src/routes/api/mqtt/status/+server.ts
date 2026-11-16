// src/routes/api/mqtt/status/+server.ts
import { json } from '@sveltejs/kit';
import { getMqttStatus } from '$lib/server/mqtt-status';

/**
 * GET /api/mqtt/status            -> Basisstatus (connected, Zähler, Durchsatz, Keepalive-Ping)
 * GET /api/mqtt/status?ping=1     -> zusätzlich aktiver Roundtrip in ms (gecacht, max. alle 5 s)
 * GET /api/mqtt/status?detail=1   -> zusätzlich Subscription-Liste und Top-10-Topics
 */
export const GET = async ({ url }) =>
	json(
		await getMqttStatus({
			ping: url.searchParams.has('ping'),
			detail: url.searchParams.has('detail')
		}),
		{ headers: { 'cache-control': 'no-store' } }
	);