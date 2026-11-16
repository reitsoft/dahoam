// src/lib/server/mqtt-status.ts
// Sammelt Laufzeit-Statistiken am bestehenden mqtt.js-Client (Nachrichten, Bytes,
// Topics, Subscriptions, Reconnects, Latenz). Nur serverseitig verwenden.
//
// Wichtig: Dieses Modul muss beim Serverstart importiert werden (z. B. in
// hooks.server.ts: `import '$lib/server/mqtt-stats';`), sonst zählt es erst ab
// dem ersten Aufruf der Status-Route.

import type { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mqttClient } from '$lib/server/mqtt';

/** Obergrenze für unterschiedliche Topics im Speicher (Schutz vor unbegrenztem Wachstum). */
const MAX_TOPICS = 5000;
/** Aktiver Roundtrip-Ping wird höchstens so oft wirklich gesendet. */
const PING_CACHE_MS = 5000;

interface TopicStat {
	count: number;
	bytes: number;
	lastAt: number;
}

/** Minimale Sicht auf mqtt-packet, unabhängig von der mqtt.js-Version. */
interface AnyPacket {
	cmd: string;
	topic?: string;
	payload?: Buffer | string;
	subscriptions?: { topic: string }[];
	unsubscriptions?: string[];
}

const round = (n: number, stellen = 1) => Math.round(n * 10 ** stellen) / 10 ** stellen;

/** Gleitender Durchschnitt über die letzten 60 Sekunden (1-s-Buckets). */
class Rate {
	private buckets = new Array<number>(60).fill(0);
	private lastSec = Math.floor(Date.now() / 1000);

	add(n = 1) {
		this.advance();
		this.buckets[this.lastSec % 60] += n;
	}

	/** Durchschnitt pro Sekunde über `windowS` Sekunden (max. 60). */
	perSecond(windowS: number) {
		this.advance();
		const sum = this.buckets.reduce((a, b) => a + b, 0);
		return sum / Math.max(1, Math.min(60, windowS));
	}

	private advance() {
		const now = Math.floor(Date.now() / 1000);
		const gap = Math.min(now - this.lastSec, 60);
		for (let i = 1; i <= gap; i++) this.buckets[(this.lastSec + i) % 60] = 0;
		this.lastSec = now;
	}
}

class MqttStats {
	readonly startedAt = Date.now();
	readonly pingTopic = `_status/ping/${mqttClient.options.clientId ?? 'server'}`;

	connectedAt: number | null = mqttClient.connected ? Date.now() : null;
	reconnects = 0;
	lastError: { message: string; at: number } | null = null;

	msgIn = 0;
	msgOut = 0;
	bytesIn = 0;
	bytesOut = 0;
	lastMessageAt: number | null = null;

	private rateMsgIn = new Rate();
	private rateMsgOut = new Rate();
	private rateBytesIn = new Rate();
	private rateBytesOut = new Rate();

	topics = new Map<string, TopicStat>();
	topicsCapped = false;
	subscriptions = new Set<string>();

	/** Letzte Keepalive-Ping-Zeit (PINGREQ → PINGRESP), passiv gemessen. */
	keepalivePingMs: number | null = null;
	keepalivePingAt: number | null = null;
	private pingSentAt: number | null = null;

	private pending = new Map<string, { t0: number; resolve: (ms: number) => void }>();
	private pingSubscribed = false;
	private activePing: { ms: number | null; at: number } | null = null;

	constructor() {
		const ev = mqttClient as unknown as EventEmitter;

		ev.on('connect', () => {
			this.connectedAt = Date.now();
			this.pingSubscribed = false;
		});
		ev.on('close', () => {
			this.connectedAt = null;
		});
		ev.on('reconnect', () => {
			this.reconnects++;
		});
		ev.on('error', (err: Error) => {
			this.lastError = { message: err?.message ?? String(err), at: Date.now() };
		});

		ev.on('message', (topic: string, payload: Buffer) => {
			if (topic === this.pingTopic) {
				const p = this.pending.get(payload.toString());
				p?.resolve(performance.now() - p.t0);
				return;
			}
			const now = Date.now();
			const bytes = payload?.length ?? 0;
			this.msgIn++;
			this.bytesIn += bytes;
			this.rateMsgIn.add();
			this.rateBytesIn.add(bytes);
			this.lastMessageAt = now;

			const t = this.topics.get(topic);
			if (t) {
				t.count++;
				t.bytes += bytes;
				t.lastAt = now;
			} else if (this.topics.size < MAX_TOPICS) {
				this.topics.set(topic, { count: 1, bytes, lastAt: now });
			} else {
				this.topicsCapped = true;
			}
		});

		ev.on('packetsend', (p: AnyPacket) => {
			switch (p.cmd) {
				case 'publish': {
					if (p.topic === this.pingTopic) return;
					const bytes = p.payload == null ? 0 : Buffer.byteLength(p.payload);
					this.msgOut++;
					this.bytesOut += bytes;
					this.rateMsgOut.add();
					this.rateBytesOut.add(bytes);
					break;
				}
				case 'subscribe':
					for (const s of p.subscriptions ?? []) {
						if (s.topic !== this.pingTopic) this.subscriptions.add(s.topic);
					}
					break;
				case 'unsubscribe':
					for (const t of p.unsubscriptions ?? []) this.subscriptions.delete(t);
					break;
				case 'pingreq':
					this.pingSentAt = performance.now();
					break;
			}
		});

		ev.on('packetreceive', (p: AnyPacket) => {
			if (p.cmd === 'pingresp' && this.pingSentAt != null) {
				this.keepalivePingMs = round(performance.now() - this.pingSentAt);
				this.keepalivePingAt = Date.now();
				this.pingSentAt = null;
			}
		});
	}

	/**
	 * Aktiver Roundtrip: Publish auf ein eigenes Topic, das der Client selbst abonniert hat.
	 * Misst Client → Broker → Client. Gibt null zurück bei Timeout, Trennung oder
	 * fehlender Berechtigung (ACL).
	 */
	async roundtrip(timeoutMs = 2000): Promise<number | null> {
		if (!mqttClient.connected) return null;
		if (this.activePing && Date.now() - this.activePing.at < PING_CACHE_MS) {
			return this.activePing.ms;
		}

		if (!this.pingSubscribed) {
			const ok = await new Promise<boolean>((resolve) => {
				mqttClient.subscribe(this.pingTopic, { qos: 0 }, (err, granted) => {
					resolve(!err && (granted ?? []).every((g) => g.qos !== 128));
				});
			});
			if (!ok) {
				this.activePing = { ms: null, at: Date.now() };
				return null;
			}
			this.pingSubscribed = true;
		}

		const id = randomUUID();
		const ms = await new Promise<number | null>((resolve) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				resolve(null);
			}, timeoutMs);
			this.pending.set(id, {
				t0: performance.now(),
				resolve: (v) => {
					clearTimeout(timer);
					this.pending.delete(id);
					resolve(v);
				}
			});
			mqttClient.publish(this.pingTopic, id, { qos: 0 });
		});

		this.activePing = { ms: ms == null ? null : round(ms), at: Date.now() };
		return this.activePing.ms;
	}

	async snapshot(opts: { detail?: boolean; ping?: boolean } = {}) {
		const now = Date.now();
		const windowS = Math.min(60, Math.max(1, (now - this.startedAt) / 1000));

		const base = {
			connected: mqttClient.connected,
			host: mqttClient.options.hostname ?? mqttClient.options.host ?? null,
			clientId: mqttClient.options.clientId ?? null,
			connectedSinceS: this.connectedAt ? Math.round((now - this.connectedAt) / 1000) : null,
			reconnects: this.reconnects,
			lastError: this.lastError
				? { message: this.lastError.message, ageS: Math.round((now - this.lastError.at) / 1000) }
				: null,
			messages: {
				in: this.msgIn,
				out: this.msgOut,
				inPerSec: round(this.rateMsgIn.perSecond(windowS), 2),
				outPerSec: round(this.rateMsgOut.perSecond(windowS), 2)
			},
			// Nur Payload-Bytes, ohne MQTT-/TCP-Header
			bytes: {
				in: this.bytesIn,
				out: this.bytesOut,
				inPerSec: round(this.rateBytesIn.perSecond(windowS)),
				outPerSec: round(this.rateBytesOut.perSecond(windowS))
			},
			topics: {
				seen: this.topics.size,
				seenCapped: this.topicsCapped,
				subscriptions: this.subscriptions.size
			},
			lastMessageAgeS: this.lastMessageAt ? Math.round((now - this.lastMessageAt) / 1000) : null,
			keepalive: {
				intervalS: mqttClient.options.keepalive ?? null,
				pingMs: this.keepalivePingMs,
				pingAgeS: this.keepalivePingAt ? Math.round((now - this.keepalivePingAt) / 1000) : null
			},
			collectingSinceS: Math.round((now - this.startedAt) / 1000)
		};

		const extra: Record<string, unknown> = {};

		if (opts.ping) {
			extra.roundtripMs = await this.roundtrip();
		}

		if (opts.detail) {
			extra.subscriptionList = [...this.subscriptions].sort();
			extra.topTopics = [...this.topics]
				.sort((a, b) => b[1].count - a[1].count)
				.slice(0, 10)
				.map(([topic, t]) => ({
					topic,
					count: t.count,
					bytes: t.bytes,
					lastAgeS: Math.round((now - t.lastAt) / 1000)
				}));
		}

		return { ...base, ...extra };
	}
}

// Bei HMR im Dev-Modus nicht doppelt am selben Client registrieren
const g = globalThis as typeof globalThis & {
	__mqttStats?: { client: unknown; stats: MqttStats };
};
const entry =
	g.__mqttStats?.client === mqttClient
		? g.__mqttStats
		: (g.__mqttStats = { client: mqttClient, stats: new MqttStats() });

export const mqttStats = entry.stats;

export const getMqttStatus = (opts?: { detail?: boolean; ping?: boolean }) =>
	mqttStats.snapshot(opts);