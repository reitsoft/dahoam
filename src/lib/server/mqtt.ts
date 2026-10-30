// src/lib/server/mqtt.ts
import { env } from '$env/dynamic/private';
import { EventEmitter } from 'node:events';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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
	switch0Enabled: true, // Entspricht dem Web-UI-Schalter (ob Klingel aktiv/deaktiviert ist)
	output0: false,
	output1: false // E-Türöffner
};

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
		if (topic === 'Klingel-Tuer/events') {
			try {
				const data = JSON.parse(payload);
				const params = data.params;

				if (params) {
					// Prüfen, ob input:0 gemeldet wurde (Klingeltaster gedrückt)
					if (params['input:0'] !== undefined) {
						doorbellState.input0 = params['input:0'].state === true;

						// Bedingung: Wenn Input 0 = 1 (true) UND Klingel aktiv/eingeschaltet (switch0Enabled === true, bzw. negiert 'deaktiviert = 0')
						if (doorbellState.input0 && doorbellState.switch0Enabled) {
							console.log('🔔 Klingel betätigt! Schalte Output 0 ein...');
							
							// MQTT-Befehl senden, um output:0 (Switch 0) einzuschalten (RPC-Methode Switch.Set)
							mqttClient.publish(
								'Klingel-Tuer/rpc',
								JSON.stringify({
									id: 1,
									src: CLIENT_ID,
									method: 'Switch.Set',
									params: { id: 0, on: true }
								})
							);
						}
					}

					// Optional: Status von switch:0, switch:1, switch:2 mitlesen
					for (let i = 0; i <= 2; i++) {
						if (params[`switch:${i}`] !== undefined) {
							const outputState = params[`switch:${i}`].output;
							if (i === 0) doorbellState.output0 = outputState;
							if (i === 1) doorbellState.output1 = outputState; // E-Türöffner
						}
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
