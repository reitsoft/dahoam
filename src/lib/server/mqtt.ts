// src/lib/server/mqtt.ts
import { env } from '$env/dynamic/private';
import { EventEmitter } from 'node:events';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import mqtt from 'mqtt';
import { SHUTTER_LIST } from '$lib/config/shutters';
import { SENSOR_LIST } from '$lib/config/sensors';

declare global {
	// eslint-disable-next-line no-var
	var __mqttClient: mqtt.MqttClient | undefined;
}

interface SensorState {
	temperature: number | null;
	humidity: number | null;
	batteryPercent: number | null;
	lastUpdated: number | null;
}

const SENSOR_CACHE_PATH = join(process.cwd(), '.sensor-cache.json');

export const CLIENT_ID = `stromzaehler-dashboard-${env.NODE_ENV === 'production' ? 'prod' : 'dev'}-${process.pid}`;

export const mqttEvents = new EventEmitter();

export const shutterStates = new Map<string, { pos: number; state: string }>();

export const sensorStates = new Map<string, SensorState>();

// Status-Speicher für die Klingel / Shelly Pro 3 (Klingel-Tuer)
export const doorbellState = {
	input0: false,
	switch0Enabled: true, // Klingel aktiv (true) oder stummgeschaltet (false)
	mutedUntil: null as number | null, // Unix-ms, nur gesetzt solange stumm
	output0: false,
	output1: false // E-Türöffner
};

// --- Klingel stummschalten (mit Auto-Reaktivierung und Persistenz) ---
const DATA_DIR = env.DATA_DIR ?? join(process.cwd(), 'data');
const KLINGEL_STATE_PATH = join(DATA_DIR, 'klingel.json');
export const KLINGEL_STUMM_DAUER_MS = 8 * 60 * 60 * 1000; // 8 Stunden

let klingelTimer: ReturnType<typeof setTimeout> | null = null;

function persistKlingel() {
	try {
		mkdirSync(DATA_DIR, { recursive: true });
		writeFileSync(KLINGEL_STATE_PATH, JSON.stringify({ mutedUntil: doorbellState.mutedUntil }));
	} catch (err) {
		console.error('⚠️ Klingel-Zustand konnte nicht gespeichert werden:', err);
	}
}

function planKlingelReset() {
	if (klingelTimer) {
		clearTimeout(klingelTimer);
		klingelTimer = null;
	}
	if (doorbellState.mutedUntil === null) return;
	const rest = Math.max(doorbellState.mutedUntil - Date.now(), 0);
	klingelTimer = setTimeout(() => isKlingelAktiv(), rest + 100);
}

/** Schaltet die Klingel an oder für 8 Stunden stumm. */
export function setKlingelAktiv(aktiv: boolean) {
	doorbellState.switch0Enabled = aktiv;
	doorbellState.mutedUntil = aktiv ? null : Date.now() + KLINGEL_STUMM_DAUER_MS;
	persistKlingel();
	planKlingelReset();
	console.log(aktiv ? '🔔 Klingel aktiv.' : '🔇 Klingel stumm für 8 Stunden.');
	mqttEvents.emit('klingel', {
		klingelAktiv: doorbellState.switch0Enabled,
		mutedUntil: doorbellState.mutedUntil
	});
}

/** Liefert den Klingel-Zustand und hebt eine abgelaufene Stummschaltung auf. */
export function isKlingelAktiv(): boolean {
	if (
		!doorbellState.switch0Enabled &&
		doorbellState.mutedUntil !== null &&
		Date.now() >= doorbellState.mutedUntil
	) {
		console.log('⏰ Stummschaltung abgelaufen.');
		setKlingelAktiv(true);
	}
	return doorbellState.switch0Enabled;
}

function loadKlingelState() {
	try {
		if (!existsSync(KLINGEL_STATE_PATH)) return;
		const { mutedUntil } = JSON.parse(readFileSync(KLINGEL_STATE_PATH, 'utf-8'));
		if (typeof mutedUntil === 'number' && mutedUntil > Date.now()) {
			doorbellState.switch0Enabled = false;
			doorbellState.mutedUntil = mutedUntil;
			planKlingelReset();
			console.log('🔇 Klingel-Stummschaltung nach Neustart wiederhergestellt.');
		}
	} catch {
		// defekte Datei ignorieren, Klingel bleibt aktiv
	}
}
loadKlingelState();

function loadSensorCache(): Record<string, SensorState> {
	if (!existsSync(SENSOR_CACHE_PATH)) return {};
	try {
		return JSON.parse(readFileSync(SENSOR_CACHE_PATH, 'utf-8'));
	} catch {
		return {};
	}
}

function saveSensorCache() {
	try {
		writeFileSync(SENSOR_CACHE_PATH, JSON.stringify(Object.fromEntries(sensorStates)));
	} catch (err) {
		console.error('⚠️ Sensor-Cache konnte nicht geschrieben werden:', err);
	}
}

const cache = loadSensorCache();
for (const sensor of SENSOR_LIST) {
	sensorStates.set(
		sensor.id,
		cache[sensor.id] ?? { temperature: null, humidity: null, batteryPercent: null, lastUpdated: null }
	);
}

for (const shutter of SHUTTER_LIST) {
	shutterStates.set(shutter.id, { pos: 0, state: 'stop' });
}

// Singleton-Guard: verhindert, dass bei HMR-Reloads (Dev-Server) oder
// versehentlichen Mehrfach-Importen mehrere parallele MQTT-Clients
// entstehen, die sich gegenseitig disconnecten/reconnecten lassen.
export const mqttClient =
	globalThis.__mqttClient ??
	mqtt.connect('mqtt://192.168.0.100:1883', {
		clientId: CLIENT_ID,
		username: env.MQTT_USER,
		password: env.MQTT_PASSWORD
	});

if (!globalThis.__mqttClient) {
	globalThis.__mqttClient = mqttClient;

	mqttClient.on('connect', () => {
		console.log('✅ MQTT mit Broker verbunden');

		mqttClient.subscribe('+/status/cover:0');
		mqttClient.subscribe('+/events/rpc'); // Shelly H&T Gen3 Notify-Nachrichten (Keller-Sensor)
		mqttClient.subscribe('Klingel-Tuer/events'); // Shelly Pro 3 Klingel Events
		mqttClient.subscribe(`${CLIENT_ID}/rpc`); // Antworten auf Status-Abfragen UND auf Commands laufen hier auf

		// Beim Verbindungsaufbau aktiv den aktuellen Stand jedes Rolladens abfragen,
		// da Shellys ihren Status sonst erst bei der nächsten Bewegung publizieren.
		for (const shutter of SHUTTER_LIST) {
			mqttClient.publish(
				`${shutter.mqttId}/rpc`,
				JSON.stringify({ id: 1, src: CLIENT_ID, method: 'Cover.GetStatus', params: { id: 0 } })
			);
		}
	});

	// Ohne diesen Handler wirft Node bei einem MQTT-Fehler (z. B. falsche
	// Zugangsdaten, Broker nicht erreichbar) eine uncaught exception, da
	// mqttClient intern ein EventEmitter ist.
	mqttClient.on('error', (err) => {
		console.error('❌ MQTT-Fehler:', err.message);
	});

	mqttClient.on('reconnect', () => {
		console.warn('⏳ MQTT: Verbindung verloren, versuche Reconnect …');
	});

	mqttClient.on('message', (topic, message) => {
		const payload = message.toString();
		const parts = topic.split('/');
		const mqttId = parts[0];

		// --- Klingel-Logik (Shelly Pro 3: Klingel-Tuer/events) ---
				// --- Klingel-Logik (Shelly Pro 3: Klingel-Tuer/events/rpc) ---
		if (topic === 'Klingel-Tuer/events/rpc') {
			try {
				const data = JSON.parse(payload);
				if (data.method !== 'NotifyStatus' && data.method !== 'NotifyFullStatus') return;
				const params = data.params;
				if (!params) return;

				// Klingeltaster an S1 (input:0) gedrückt?
				const input = params['input:0'];
				if (input && typeof input.state === 'boolean') {
					doorbellState.input0 = input.state;

					if (input.state && isKlingelAktiv()) {
						console.log('🔔 Klingel betätigt! Schalte Output 0 ein...');
						mqttClient.publish(
							'Klingel-Tuer/rpc',
							JSON.stringify({
								id: 1,
								src: CLIENT_ID,
								method: 'Switch.Set',
								params: { id: 0, on: true, toggle_after: 0.5 }
							})
						);
					} else if (input.state) {
						console.log('🔇 Klingel gedrückt, aber stummgeschaltet.');
					}
				}

				// Ausgangszustände mitlesen (nur wenn die Nachricht "output" enthält)
				for (let i = 0; i <= 1; i++) {
					const out = params[`switch:${i}`]?.output;
					if (typeof out === 'boolean') {
						if (i === 0) doorbellState.output0 = out;
						if (i === 1) doorbellState.output1 = out; // E-Türöffner
					}
				}
			} catch {
				// ungültiges JSON ignorieren
			}
			return;
		}

		// Antworten auf unsere Cover.GetStatus-Abfrage und auf Commands kommen auf <CLIENT_ID>/rpc zurück
		if (topic === `${CLIENT_ID}/rpc`) {
			try {
				const data = JSON.parse(payload);
				const matched = SHUTTER_LIST.find((s) => s.mqttId === data.src);
				if (!matched || !data.result) return;

				const current = shutterStates.get(matched.id) || { pos: 0, state: 'stop' };
				if (typeof data.result.current_pos === 'number') current.pos = data.result.current_pos;
				if (typeof data.result.state === 'string') current.state = data.result.state;

				shutterStates.set(matched.id, current);
				mqttEvents.emit('update', { id: matched.id, state: current });
			} catch {
				// ungültiges JSON ignorieren
			}
			return;
		}

		// Sensor-Notifies vom Shelly H&T Gen3 (Topic: <mqttId>/events/rpc).
		if (parts[1] === 'events' && parts[2] === 'rpc') {
			const matchedSensor = SENSOR_LIST.find((s) => s.mqttId === mqttId);
			if (!matchedSensor) return;

			try {
				const data = JSON.parse(payload);
				const method = data.method;
				if (method !== 'NotifyFullStatus' && method !== 'NotifyStatus') return;

				const p = data.params;
				const current = sensorStates.get(matchedSensor.id) || {
					temperature: null,
					humidity: null,
					batteryPercent: null,
					lastUpdated: null
				};

				if (p['temperature:0']?.tC !== undefined) current.temperature = p['temperature:0'].tC;
				if (p['humidity:0']?.rh !== undefined) current.humidity = p['humidity:0'].rh;
				if (p['devicepower:0']?.battery?.percent !== undefined) {
					current.batteryPercent = p['devicepower:0'].devicepower?.battery?.percent ?? p['devicepower:0'].battery.percent;
				}
				current.lastUpdated = Date.now();

				sensorStates.set(matchedSensor.id, current);
				saveSensorCache();
				mqttEvents.emit('sensor-update', { id: matchedSensor.id, state: current });
			} catch {
				// ungültiges JSON ignorieren
			}
			return;
		}

		// Normale Status-Push-Nachrichten bei Zustandsänderungen (Topic: <mqttId>/status/cover:0)
		const matched = SHUTTER_LIST.find((s) => s.mqttId === mqttId);
		if (!matched) return;

		const current = shutterStates.get(matched.id) || { pos: 0, state: 'stop' };

		try {
			const data = JSON.parse(payload);
			if (typeof data.current_pos === 'number') current.pos = data.current_pos;
			if (typeof data.state === 'string') current.state = data.state;
		} catch {
			return;
		}

		shutterStates.set(matched.id, current);

		mqttEvents.emit('update', {
			id: matched.id,
			state: current
		});
	});

	// Sauberes Beenden beim Stoppen des Dev-Servers / Prozess-Neustart
	const shutdown = () => {
		mqttClient.end(true, {}, () => process.exit(0));
	};
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
}

// --- Türöffner (Shelly Pro 3, Output 1) ---
const TUER_OEFFNUNGSZEIT_S = 3;
let letzteTuerOeffnung = 0;

/**
 * Schaltet Output 1 (E-Türöffner) am Shelly Pro 3 für 3 Sekunden ein.
 * Das Zurückschalten übernimmt der Shelly selbst (toggle_after).
 */
export function triggerDoorOpener(): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!mqttClient.connected) {
			reject(new Error('MQTT nicht verbunden'));
			return;
		}

		// Erneutes Auslösen während der Öffnungszeit ignorieren (Timer nicht verlängern)
		const jetzt = Date.now();
		if (jetzt - letzteTuerOeffnung < TUER_OEFFNUNGSZEIT_S * 1000) {
			resolve();
			return;
		}

		mqttClient.publish(
			'Klingel-Tuer/rpc',
			JSON.stringify({
				id: 2,
				src: CLIENT_ID,
				method: 'Switch.Set',
				params: { id: 1, on: true, toggle_after: TUER_OEFFNUNGSZEIT_S }
			}),
			{ qos: 1 },
			(err) => {
				if (err) {
					reject(err);
				} else {
					letzteTuerOeffnung = jetzt;
					resolve();
				}
			}
		);
	});
}