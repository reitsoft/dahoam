// src/lib/server/homeconnect.ts
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { mqttClient, mqttEvents } from './mqtt';

declare global {
	// eslint-disable-next-line no-var
	var __homeConnectStarted: boolean | undefined;
}

const API = env.BOSCH_API;
const CLIENT_ID = env.BOSCH_CLIENT_ID;
const BASE = env.BOSCH_MQTT_TOPIC ?? 'haushalt/geschirrspueler';

const DATA_DIR = env.DATA_DIR ?? join(process.cwd(), 'data');
const TOKEN_PATH = join(DATA_DIR, 'homeconnect.json');

export const geschirrspuelerState = {
	state: null as string | null,
	program: null as string | null, // z. B. "Quick65"
	progress: null as number | null, // 0-100
	endsAt: null as number | null, // Unix-ms, voraussichtliches Ende
	rinseAidLow: false,
	saltLow: false,
	doorOpen: null as boolean | null, // null = noch unbekannt
	fertigAm: null as number | null
};

// --- Refresh-Token: gespeicherter Wert hat Vorrang, außer BOSCH_TOKEN in der .env wurde ausgetauscht ---
let refreshToken = env.BOSCH_TOKEN ?? '';

function loadToken() {
	try {
		if (!existsSync(TOKEN_PATH)) return;
		const saved = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
		if (saved.origin === env.BOSCH_TOKEN && typeof saved.refreshToken === 'string') {
			refreshToken = saved.refreshToken;
		}
	} catch {
		// defekte Datei ignorieren, .env-Token verwenden
	}
}

function saveToken() {
	try {
		mkdirSync(DATA_DIR, { recursive: true });
		writeFileSync(TOKEN_PATH, JSON.stringify({ origin: env.BOSCH_TOKEN, refreshToken }));
	} catch (err) {
		console.error('⚠️ Home-Connect-Token konnte nicht gespeichert werden:', err);
	}
}

let accessToken = '';
let expiresAt = 0;

async function refresh() {
	const res = await fetch(`${API}/security/oauth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			client_id: CLIENT_ID!
		})
	});
	if (!res.ok) throw new Error(`Token-Refresh fehlgeschlagen: ${res.status} ${await res.text()}`);
	const j = await res.json();
	accessToken = j.access_token;
	expiresAt = Date.now() + (j.expires_in - 300) * 1000;
	if (j.refresh_token && j.refresh_token !== refreshToken) {
		refreshToken = j.refresh_token;
		saveToken();
	}
	console.log('🔑 Home-Connect-Token erneuert');
}

// --- Events verarbeiten ---
let lastFinished = 0;
function finished() {
	if (Date.now() - lastFinished < 60_000) return;
	lastFinished = Date.now();
	geschirrspuelerState.fertigAm = lastFinished;
	console.log('🍽️ Geschirrspüler fertig');
	mqttClient.publish(`${BASE}/fertig`, '1');
	mqttClient.publish(`${BASE}/fertig_zeit`, new Date(lastFinished).toISOString(), { retain: true });
}

function applyItem(key: string, value: unknown) {
	const s = geschirrspuelerState;
	const last = String(value).split('.').pop()!;
	switch (key) {
		case 'BSH.Common.Status.OperationState':
			s.state = last;
			mqttClient.publish(`${BASE}/state`, last, { retain: true });
			if (last === 'Finished') {
				s.progress = 100;
				s.endsAt = null;
				finished();
			} else if (last === 'Inactive' || last === 'Ready') {
				s.progress = null;
				s.endsAt = null;
			}
			break;
		case 'BSH.Common.Event.ProgramFinished':
			if (last === 'Present') finished();
			break;
		case 'BSH.Common.Root.ActiveProgram':
			s.program = last;
			mqttClient.publish(`${BASE}/program`, last, { retain: true });
			break;
		case 'BSH.Common.Option.ProgramProgress':
			s.progress = Number(value);
			mqttClient.publish(`${BASE}/progress`, String(s.progress), { retain: true });
			break;
		case 'BSH.Common.Option.RemainingProgramTime':
			s.endsAt = Date.now() + Number(value) * 1000;
			break;
		case 'BSH.Common.Status.DoorState':
			s.doorOpen = last === 'Open'; // "Closed" und "Locked" gelten als zu
			mqttClient.publish(`${BASE}/tuer`, last, { retain: true });
			break;
		case 'Dishcare.Dishwasher.Event.RinseAidNearlyEmpty':
			s.rinseAidLow = last === 'Present';
			mqttClient.publish(`${BASE}/klarspueler_leer`, s.rinseAidLow ? '1' : '0', { retain: true });
			break;
		case 'Dishcare.Dishwasher.Event.SaltNearlyEmpty':
			s.saltLow = last === 'Present';
			mqttClient.publish(`${BASE}/salz_leer`, s.saltLow ? '1' : '0', { retain: true });
			break;
	}
}

function handle(raw: string) {
	let d: { items?: { key: string; value: unknown }[] };
	try {
		d = JSON.parse(raw);
	} catch {
		return;
	}
	for (const { key, value } of d.items ?? []) applyItem(key, value);
	mqttEvents.emit('geschirrspueler', { ...geschirrspuelerState });
}

// Der SSE-Stream sendet nur Änderungen. Den Ausgangszustand holen wir einmal pro Verbindung per REST.
async function loadInitial() {
	const get = async (path: string) => {
		const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
		return res.ok ? (await res.json()).data : null;
	};
	try {
		const list = await get('/api/homeappliances');
		const ha = list?.homeappliances?.find((a: { type: string }) => a.type === 'Dishwasher');
		if (!ha) return;
		const status = await get(`/api/homeappliances/${ha.haId}/status`);
		for (const it of status?.status ?? []) applyItem(it.key, it.value);
		const active = await get(`/api/homeappliances/${ha.haId}/programs/active`);
		if (active) {
			applyItem('BSH.Common.Root.ActiveProgram', active.key);
			for (const it of active.options ?? []) applyItem(it.key, it.value);
		}
		mqttEvents.emit('geschirrspueler', { ...geschirrspuelerState });
	} catch (e) {
		console.error('⚠️ Home Connect Initialzustand:', (e as Error).message);
	}
}

// --- SSE-Stream ---
async function stream() {
	if (Date.now() >= expiresAt) await refresh();
    await loadInitial();

	const ctrl = new AbortController();
	const res = await fetch(`${API}/api/homeappliances/events`, {
		headers: { Authorization: `Bearer ${accessToken}`, Accept: 'text/event-stream' },
		signal: ctrl.signal
	});
	if (res.status === 401) {
		expiresAt = 0;
		throw new Error('401, Token wird erneuert');
	}
	if (res.status === 429) throw new Error('Rate-Limit erreicht');
	if (!res.ok || !res.body) throw new Error(`SSE-Fehler ${res.status}`);
	console.log('✅ Home-Connect-Stream verbunden');

	// Watchdog: Keep-Alive kommt ca. alle 55 s
	let timer = setTimeout(() => ctrl.abort(), 120_000);
	const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
	let buf = '';
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			clearTimeout(timer);
			timer = setTimeout(() => ctrl.abort(), 120_000);
			buf += value;
			let idx: number;
			while ((idx = buf.indexOf('\n\n')) !== -1) {
				const block = buf.slice(0, idx);
				buf = buf.slice(idx + 2);
				let type = '';
				let data = '';
				for (const line of block.split('\n')) {
					if (line.startsWith('event:')) type = line.slice(6).trim();
					else if (line.startsWith('data:')) data += line.slice(5).trim();
				}
				if (data && ['NOTIFY', 'STATUS', 'EVENT'].includes(type)) handle(data);
			}
		}
	} finally {
		clearTimeout(timer);
	}
}

async function run() {
	let backoff = 5000;
	while (true) {
		const start = Date.now();
		try {
			await stream();
		} catch (e) {
			console.error('❌ Home Connect:', (e as Error).message);
		}
		// Backoff nur erhöhen, wenn die Verbindung kaum stand
		backoff = Date.now() - start > 60_000 ? 5000 : Math.min(backoff * 2, 300_000);
		console.log(`⏳ Home Connect: Reconnect in ${backoff / 1000} s`);
		await new Promise((r) => setTimeout(r, backoff));
	}
}

// Singleton-Guard (HMR) und kein Start während `vite build`
if (!building && !globalThis.__homeConnectStarted) {
	if (!API || !CLIENT_ID || !refreshToken) {
		console.warn('⚠️ Home Connect nicht gestartet: BOSCH_API, BOSCH_CLIENT_ID oder BOSCH_TOKEN fehlt');
	} else {
		globalThis.__homeConnectStarted = true;
		loadToken();
		run();
	}
}
