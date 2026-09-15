// src/routes/api/termine/[id]/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteTermin } from '$lib/server/termine';

export const DELETE: RequestHandler = async ({ params }) => {
	const erfolg = deleteTermin(params.id);

	if (!erfolg) {
		return json({ error: 'Termin nicht gefunden' }, { status: 404 });
	}

	return json({ success: true });
};