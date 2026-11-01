// src/lib/server/luefter.ts
import { env } from '$env/dynamic/private';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { mqttClient, mqttEvents, sensorStates, CLIENT_ID } from '$lib/server/mqtt';

export type Modus = 'AUTO' | 'TIMER' | 'AUS';

// --- Konfiguration ---
const LUEFTER_MQTT_ID = 'bad-luefter'; // MQTT-Präfix des Shelly, der den Lüfter schaltet
const LUEFTER_SWITCH_ID = 0; // Kanal am Shelly (switch:0)
const SENSOR_ID = 'bad'; // ID in SENSOR_LIST (Shelly H&T Gen3)

const HUMIDITY_THRESHOLD = 70; // Einschalten ab 70 % relativer Feuchte
const HUMIDITY_HYSTERESE = 5; // Vorzeitig aus, wenn Feuchte unter 65 % fällt
const MAX_RUN_TIME_MS = 30 * 60 * 1000; // maximale Laufzeit im AUTO-Modus
const COOLDOWN_TIME_MS = 60 * 60 * 1000; // Sperrzeit nach AUTO-Lauf
const TIMER_RUN_TIME_MS = 10 * 60 * 1000; // Laufzeit im TIMER-Modus
const MAX_SENSOR_ALTER_MS = 3 * 60 * 60 * 1000; // ältere Messwerte schalten den Lüfter nicht ein
const CHECK_INTERVAL_MS = 60 * 1000; // regelmäßige Prüfung mit dem letzten bekannten Wert
const BEFEHL_PAUSE_MS = 10 * 1000; // Mindestabstand zwischen automatischen Einschaltbefehlen

const STATUS_ABFRAGE_ID = 11; // ID unserer Switch.GetStatus-Anfrage, um die Antwort zu erkennen

// --- Persistenz (Modus, Timer, Sperrzeit überleben einen Neustart) ---
const DATA_DIR = env.DATA_DIR ?? join(process.cwd(), 'data');
const STATE_PATH = join(DATA_DIR, 'luefter.json');

const state = {
	mode: 'AUTO' as Modus,
	isFanOn: false, // Wahrheit kommt vom Shelly selbst
	timerEndsAt: null as number | null,
	lastAutoOffTime: 0,
	autoRun: false // Lüfter läuft, weil die AUTO-Logik ihn eingeschaltet hat
};

let timerEndHandle: ReturnType<typeof setTimeout> | null = null;
let letzterBefehl = 0;

function persist() {
	try {
		mkdirSync(DATA_DIR, { recursive: true });
		writeFileSync(
			STATE_PATH,
			JSON.stringify({
				mode: state.mode,
				timerEndsAt: state.timerEndsAt,
				lastAutoOffTime: state.lastAutoOffTime
			})
		);
	} catch (err) {
		console.error('⚠️ Lüfter-Zustand konnte nicht gespeichert werden:', err);
	}
}

function melden() {
	mqttEvents.emit('luefter', getLuefterStatus());
}

// --- Befehle an den Shelly ---

/** Schaltet den Lüfter. Bei "ein" mit Laufzeit: Der Shelly schaltet selbst wieder ab (toggle_after). */
function setFan(on: boolean, sekunden?: number) {
	if (!mqttClient.connected) {
		console.error('❌ Lüfter: MQTT nicht verbunden, Befehl verworfen.');
		return;
	}
	letzterBefehl = Date.now();
	console.log(`🌀 Lüfter ${on ? 'ein' : 'aus'}${on && sekunden ? ` (max. ${Math.round(sekunden / 60)} Min)` : ''}`);
	mqttClient.publish(
		`${LUEFTER_MQTT_ID}/rpc`,
		JSON.stringify({
			id: 12,
			src: CLIENT_ID,
			method: 'Switch.Set',
			params: {
				id: LUEFTER_SWITCH_ID,
				on,
				...(on && sekunden ? { toggle_after: sekunden } : {})
			}
		}),
		{ qos: 1 }
	);
}

function frageFanStatusAb() {
	if (!mqttClient.connected) return;
	mqttClient.publish(
		`${LUEFTER_MQTT_ID}/rpc`,
		JSON.stringify({
			id: STATUS_ABFRAGE_ID,
			src: CLIENT_ID,
			method: 'Switch.GetStatus',
			params: { id: LUEFTER_SWITCH_ID }
		})
	);
}

// --- Zustand vom Shelly übernehmen ---
function uebernehmeFanStatus(laeuft: boolean) {
	const warAn = state.isFanOn;
	state.isFanOn = laeuft;

	if (warAn && !laeuft) {
		// Sperrzeit nur, wenn die AUTO-Logik den Lauf gestartet hat und der Lauf endet
		if (state.autoRun && state.mode === 'AUTO') {
			state.lastAutoOffTime = Date.now();
			persist();
		}
		state.autoRun = false;
	}
	melden();
}

// --- Timer-Ende (TIMER-Modus) ---
function planTimerEnde() {
	if (timerEndHandle) {
		clearTimeout(timerEndHandle);
		timerEndHandle = null;
	}
	if (state.mode !== 'TIMER' || state.timerEndsAt === null) return;
	const rest = Math.max(state.timerEndsAt - Date.now(), 0);
	timerEndHandle = setTimeout(() => {
		timerEndHandle = null;
		if (state.mode !== 'TIMER') return;
		console.log('⏰ Lüfter-Timer abgelaufen, zurück in AUTO.');
		state.mode = 'AUTO';
		state.timerEndsAt = null;
		state.autoRun = false;
		setFan(false); // zusätzlich zum toggle_after im Shelly
		persist();
		melden();
	}, rest + 100);
}

// --- Automatik ---
function pruefeFeuchte() {
	if (state.mode !== 'AUTO') return;

	const sensor = sensorStates.get(SENSOR_ID);
	const rh = sensor?.humidity;
	if (typeof rh !== 'number') return;

	const jetzt = Date.now();
	const alter = sensor?.lastUpdated ? jetzt - sensor.lastUpdated : Infinity;
	const inSperrzeit = jetzt - state.lastAutoOffTime < COOLDOWN_TIME_MS;

	// 1. Einschalten: Feuchte hoch, Lüfter aus, keine Sperrzeit, Messwert nicht veraltet
	if (
		rh >= HUMIDITY_THRESHOLD &&
		!state.isFanOn &&
		!inSperrzeit &&
		alter <= MAX_SENSOR_ALTER_MS &&
		jetzt - letzterBefehl > BEFEHL_PAUSE_MS
	) {
		state.autoRun = true;
		setFan(true, MAX_RUN_TIME_MS / 1000);
		return;
	}

	// 2. Vorzeitig ausschalten, wenn die Feuchte wieder gesunken ist
	if (rh < HUMIDITY_THRESHOLD - HUMIDITY_HYSTERESE && state.isFanOn && jetzt - letzterBefehl > BEFEHL_PAUSE_MS) {
		setFan(false);
	}
}

// --- Öffentliche API ---
export function setLuefterModus(neu: Modus) {
	if (timerEndHandle) {
		clearTimeout(timerEndHandle);
		timerEndHandle = null;
	}

	state.mode = neu;
	state.timerEndsAt = null;
	state.autoRun = false; // manuelles Umschalten löst keine Sperrzeit aus

	if (neu === 'AUS') {
		setFan(false);
	} else if (neu === 'TIMER') {
		state.timerEndsAt = Date.now() + TIMER_RUN_TIME_MS;
		setFan(true, TIMER_RUN_TIME_MS / 1000);
		planTimerEnde();
	} else {
		// AUTO: laufenden Lüfter ausschalten, danach entscheidet die Feuchte
		if (state.isFanOn) setFan(false);
	}

	persist();
	melden();
}

export function getLuefterStatus() {
	const s = sensorStates.get(SENSOR_ID);
	return {
		modus: state.mode,
		laeuft: state.isFanOn,
		timerEndsAt: state.timerEndsAt,
		temperatur: s?.temperature ?? null,
		feuchtigkeit: s?.humidity ?? null,
		aktualisiert: s?.lastUpdated ?? null,
		batterie: s?.batteryPercent ?? null
	};
}

// --- Initialisierung (einmal pro Prozess) ---
declare global {
	// eslint-disable-next-line no-var
	var __luefterInit: boolean | undefined;
}

function wiederherstellen() {
	try {
		if (!existsSync(STATE_PATH)) return;
		const d = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
		if (d.mode === 'AUTO' || d.mode === 'TIMER' || d.mode === 'AUS') state.mode = d.mode;
		if (typeof d.lastAutoOffTime === 'number') state.lastAutoOffTime = d.lastAutoOffTime;
		if (typeof d.timerEndsAt === 'number') state.timerEndsAt = d.timerEndsAt;

		if (state.mode === 'TIMER') {
			if (state.timerEndsAt !== null && state.timerEndsAt > Date.now()) {
				planTimerEnde();
			} else {
				state.mode = 'AUTO';
				state.timerEndsAt = null;
			}
		}
	} catch {
		// defekte Datei ignorieren, Standard (AUTO) gilt
	}
}

if (!globalThis.__luefterInit) {
	globalThis.__luefterInit = true;

	wiederherstellen();

	// Neue Messwerte vom Bad-Sensor
	mqttEvents.on('sensor-update', (e: { id: string }) => {
		if (e.id === SENSOR_ID) pruefeFeuchte();
	});

	// Der Shelly meldet Schaltzustände (auch bei Bedienung am Wandschalter) und antwortet auf GetStatus
	mqttClient.on('message', (topic, message) => {
		if (topic !== `${LUEFTER_MQTT_ID}/events/rpc` && topic !== `${CLIENT_ID}/rpc`) return;
		try {
			const data = JSON.parse(message.toString());
			let ausgang: unknown;

			if (topic === `${CLIENT_ID}/rpc`) {
				if (data.id !== STATUS_ABFRAGE_ID) return;
				ausgang = data.result?.output;
			} else {
				ausgang = data.params?.[`switch:${LUEFTER_SWITCH_ID}`]?.output;
			}

			if (typeof ausgang === 'boolean') uebernehmeFanStatus(ausgang);
		} catch {
			// ungültiges JSON ignorieren
		}
	});

	// Aktuellen Schaltzustand beim Start und nach jedem Reconnect abfragen
	mqttClient.on('connect', frageFanStatusAb);
	frageFanStatusAb();

	// Regelmäßig mit dem letzten bekannten Wert prüfen (z. B. wenn die Sperrzeit endet,
	// ohne dass der Sensor neu gemeldet hat)
	setInterval(pruefeFeuchte, CHECK_INTERVAL_MS).unref?.();
}