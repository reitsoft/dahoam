// src/routes/api/door/klingel/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { doorbellState, isKlingelAktiv, setKlingelAktiv } from '$lib/server/mqtt';

const noStore = { headers: { 'cache-control': 'no-store' } };

const zustand = () => ({
	success: true,
	klingelAktiv: isKlingelAktiv(),
	mutedUntil: doorbellState.mutedUntil
});

export const GET: RequestHandler = async () => json(zustand(), noStore);

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Kein gültiges JSON' }, { status: 400 });
	}

	const aktiv = (body as { aktiv?: unknown })?.aktiv;
	if (typeof aktiv !== 'boolean') {
		return json({ success: false, error: 'Ungültiger Parameter "aktiv"' }, { status: 400 });
	}

	setKlingelAktiv(aktiv);
	return json(zustand(), noStore);
};