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
		mqttClient.subscribe(`${CLIENT_ID}/rpc`); // Antworten auf Status-Abfragen UND auf Commands laufen hier auf

		// Beim Verbindungsaufbau aktiv den aktuellen Stand jedes Rolladens abfragen,
		// da Shellys ihren Status sonst erst bei der nächsten Bewegung publizieren.
		for (const shutter of SHUTTER_LIST) {
			mqttClient.publish(
				`${shutter.mqttId}/rpc`,
				JSON.stringify({ id: 1, src: CLIENT_ID, method: 'Cover.GetStatus', params: { id: 0 } })
			);
		}
		// Kein Polling für SENSOR_LIST: Der H&T Gen3 ist battery-powered/sleepy
		// und meldet sich nur selbstständig alle wakeup_period Sekunden (hier 7200s = 2h).
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

		// Antworten auf unsere Cover.GetStatus-Abfrage und auf Commands (siehe
		// src/routes/api/shutter/command/+server.ts, dort muss dieselbe CLIENT_ID
		// als "src" verwendet werden!) kommen auf <CLIENT_ID>/rpc zurück; das
		// Gerät wird über das "src"-Feld im Payload identifiziert, nicht über das Topic.
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
		// Der Sensor sendet beim Aufwachen zuerst "NotifyFullStatus" mit allen
		// Werten auf einmal, danach mehrere "NotifyStatus" mit jeweils nur einem
		// geänderten Feld — deshalb hier mergen statt überschreiben.
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
					current.batteryPercent = p['devicepower:0'].battery.percent;
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
}