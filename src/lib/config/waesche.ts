// src/lib/config/waesche.ts
export type WaescheGeraet = {
	id: 'waschmaschine' | 'trockner';
	name: string;
	mqttId: string; // MQTT-Präfix des Shelly (Einstellungen → MQTT)
	startW: number; // darüber gilt das Gerät als aktiv
	startSek: number; // so lange muss die Leistung anliegen, bevor "Läuft" gilt
	endeSek: number; // so lange muss sie darunter bleiben, bevor "Fertig" gilt
};

export const WAESCHE_LIST: WaescheGeraet[] = [
	{ id: 'waschmaschine', name: 'Waschmaschine', mqttId: 'haushalt/waschmaschine', startW: 8, startSek: 30, endeSek: 300 },
	{ id: 'trockner', name: 'Trockner', mqttId: 'haushalt/trockner', startW: 8, startSek: 30, endeSek: 300 }
];
