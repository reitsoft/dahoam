// src/routes/api/luefter/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLuefterStatus, setLuefterModus } from '$lib/server/luefter';

const noStore = { headers: { 'cache-control': 'no-store' } };

export const GET: RequestHandler = async () => json(getLuefterStatus(), noStore);

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Kein gültiges JSON' }, { status: 400 });
	}

	const modus = (body as { modus?: unknown })?.modus;
	if (modus !== 'AUTO' && modus !== 'TIMER' && modus !== 'AUS') {
		return json({ success: false, error: 'Ungültiger Modus' }, { status: 400 });
	}

	setLuefterModus(modus);
	return json({ success: true, ...getLuefterStatus() }, noStore);
};