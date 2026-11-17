// src/lib/server/waesche.ts
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { mqttClient, mqttEvents, CLIENT_ID } from './mqtt';
import { WAESCHE_LIST } from '$lib/config/waesche';

declare global {
	// eslint-disable-next-line no-var
	var __waescheStarted: boolean | undefined;
}

export type WaescheStatus = {
	status: 'BEREIT' | 'LAEUFT' | 'FERTIG';
	startedAt: number | null; // Beginn des Laufs
	fertigAm: number | null; // Zeitpunkt, an dem die Leistung zuletzt abfiel
	leistung: number | null; // Watt, nur zur Anzeige/Diagnose
};

const FERTIG_ANZEIGE_MS = 12 * 60 * 60 * 1000; // danach wieder "Bereit"

const DATA_DIR = env.DATA_DIR ?? join(process.cwd(), 'data');
const STATE_PATH = join(DATA_DIR, 'waesche.json');

export const waescheStates = new Map<string, WaescheStatus>();
// interne Zeitstempel für die Hysterese (nicht persistiert)
const intern = new Map<string, { aboveSince: number | null; lastAbove: number | null }>();

for (const g of WAESCHE_LIST) {
	waescheStates.set(g.id, { status: 'BEREIT', startedAt: null, fertigAm: null, leistung: null });
	intern.set(g.id, { aboveSince: null, lastAbove: null });
}

function persist() {
	try {
		mkdirSync(DATA_DIR, { recursive: true });
		writeFileSync(STATE_PATH, JSON.stringify(Object.fromEntries(waescheStates)));
	} catch (err) {
		console.error('⚠️ Wäsche-Zustand konnte nicht gespeichert werden:', err);
	}
}

function load() {
	try {
		if (!existsSync(STATE_PATH)) return;
		const saved = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
		for (const g of WAESCHE_LIST) {
			const s = saved[g.id];
			if (!s) continue;
			waescheStates.set(g.id, { ...s, leistung: null });
			// Lief das Gerät beim Neustart, gilt die Leistung als gerade vorhanden
			if (s.status === 'LAEUFT') intern.get(g.id)!.lastAbove = Date.now();
		}
	} catch {
		// defekte Datei ignorieren
	}
}

function publishState(id: string, s: WaescheStatus) {
	mqttClient.publish(`haushalt/${id}/status`, s.status, { retain: true });
}

function auswerten(id: string, watt: number | null) {
	const g = WAESCHE_LIST.find((x) => x.id === id)!;
	const s = waescheStates.get(id)!;
	const t = intern.get(id)!;
	const jetzt = Date.now();
	let geaendert = false;

	if (watt !== null) s.leistung = watt;
	const aktiv = (watt ?? s.leistung ?? 0) > g.startW;

	if (watt !== null) {
		if (aktiv) {
			t.lastAbove = jetzt;
			t.aboveSince ??= jetzt;
		} else {
			t.aboveSince = null;
		}
	}

	if (s.status !== 'LAEUFT') {
		// Start: Leistung muss startSek am Stück anliegen (filtert Display/Standby-Spitzen)
		if (t.aboveSince && jetzt - t.aboveSince >= g.startSek * 1000) {
			s.status = 'LAEUFT';
			s.startedAt = t.aboveSince;
			s.fertigAm = null;
			geaendert = true;
			console.log(`🧺 ${g.name} läuft.`);
		} else if (s.status === 'FERTIG' && s.fertigAm && jetzt - s.fertigAm > FERTIG_ANZEIGE_MS) {
			s.status = 'BEREIT';
			s.startedAt = null;
			s.fertigAm = null;
			geaendert = true;
		}
	} else if (t.lastAbove && jetzt - t.lastAbove >= g.endeSek * 1000) {
		// Ende: so lange unter der Schwelle, dass es keine Pause im Programm mehr sein kann
		s.status = 'FERTIG';
		s.fertigAm = t.lastAbove;
		geaendert = true;
		console.log(`✅ ${g.name} fertig.`);
		mqttClient.publish(`haushalt/${id}/fertig`, '1');
	}

	if (geaendert) {
		publishState(id, s);
		persist();
		mqttEvents.emit('waesche', { id, state: { ...s } });
	}
}

function start() {
	load();

	const topicsOf = (mqttId: string) => `${mqttId}/status/switch:0`;
	const subscribeAll = () => {
		for (const g of WAESCHE_LIST) {
			mqttClient.subscribe(topicsOf(g.mqttId));
			// Aktuellen Wert einmal aktiv abfragen, Antwort kommt auf <CLIENT_ID>/rpc
			mqttClient.publish(
				`${g.mqttId}/rpc`,
				JSON.stringify({ id: 3, src: CLIENT_ID, method: 'Switch.GetStatus', params: { id: 0 } })
			);
		}
	};
	if (mqttClient.connected) subscribeAll();
	mqttClient.on('connect', subscribeAll);

	mqttClient.on('message', (topic, message) => {
		const g = WAESCHE_LIST.find((x) => topic === topicsOf(x.mqttId));
		const antwort = topic === `${CLIENT_ID}/rpc`;
		if (!g && !antwort) return;
		try {
			const data = JSON.parse(message.toString());
			if (g) {
				if (typeof data.apower === 'number') auswerten(g.id, data.apower);
			} else {
				const gg = WAESCHE_LIST.find((x) => x.mqttId === data.src);
				if (gg && typeof data.result?.apower === 'number') auswerten(gg.id, data.result.apower);
			}
		} catch {
			// ungültiges JSON ignorieren
		}
	});

	// Ende und Zeitablauf auch ohne neue Nachricht erkennen (Shelly sendet nur bei Änderung)
	setInterval(() => {
		for (const g of WAESCHE_LIST) auswerten(g.id, null);
	}, 15_000);
}

if (!building && !globalThis.__waescheStarted) {
	globalThis.__waescheStarted = true;
	start();
}
