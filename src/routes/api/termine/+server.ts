// src/routes/api/termine/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTermine, addTermin } from '$lib/server/termine';

export const GET: RequestHandler = async () => {
	const termine = getTermine();
	// Sortiert nach Datum + Uhrzeit, nächster Termin zuerst
	termine.sort((a, b) => `${a.datum}${a.uhrzeit}`.localeCompare(`${b.datum}${b.uhrzeit}`));
	return json(termine);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	if (!body.datum || !body.uhrzeit || !body.titel) {
		return json({ error: 'Datum, Uhrzeit und Titel sind erforderlich' }, { status: 400 });
	}

	const termin = addTermin({
		datum: body.datum,
		uhrzeit: body.uhrzeit,
		titel: body.titel,
		notizen: body.notizen ?? undefined
	});

	return json(termin, { status: 201 });
};