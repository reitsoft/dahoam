// src/lib/server/termine.ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface Termin {
	id: string;
	datum: string;      // ISO-Datum, z. B. "2026-09-20"
	uhrzeit: string;     // "HH:MM"
	titel: string;
	notizen?: string;
}

const TERMINE_PATH = join(process.cwd(), '.termine.json');

export function getTermine(): Termin[] {
	if (!existsSync(TERMINE_PATH)) {
		return [];
	}
	try {
		const raw = readFileSync(TERMINE_PATH, 'utf-8');
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch (err) {
		console.error('❌ Fehler beim Lesen der Termine-Datei:', err);
		return [];
	}
}

function speichernTermine(termine: Termin[]) {
	writeFileSync(TERMINE_PATH, JSON.stringify(termine, null, 2), 'utf-8');
}

export function addTermin(input: Omit<Termin, 'id'>): Termin {
	const termine = getTermine();
	const neuerTermin: Termin = {
		id: randomUUID(),
		...input
	};
	termine.push(neuerTermin);
	speichernTermine(termine);
	return neuerTermin;
}

export function deleteTermin(id: string): boolean {
	const termine = getTermine();
	const gefiltert = termine.filter((t) => t.id !== id);
	if (gefiltert.length === termine.length) {
		return false;
	}
	speichernTermine(gefiltert);
	return true;
}