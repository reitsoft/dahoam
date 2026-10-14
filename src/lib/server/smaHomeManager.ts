/**
 * SMA Sunny Home Manager 2.0 – Datenzugriff auf InfluxDB
 *
 * Ablegen unter: src/lib/server/smaHomeManager.ts
 *
 * Datenquelle (Measurement `sma_netz`, Feld `value`, Tag `metric`):
 *   sma_raw  (48 h)     Rohdaten, ca. 1 Wert/s
 *   sma_15m  (14 Tage)  15-Minuten-Werte
 *   sma_1h   (90 Tage)  Stundenwerte
 *   sma_1d   (2 Jahre)  Tageswerte
 *   sma_1mo  (5 Jahre)  Monatswerte
 *   sma_1y   (unbegr.)  Jahreswerte
 *
 * Aggregierte Buckets: Leistungen (W) = Mittelwert, Zählerstände (kWh) = letzter Wert.
 * Der Zeitstempel ist der BEGINN der Periode (Tage/Monate/Jahre in Europe/Berlin).
 * Ein Zählerstand in einem aggregierten Bucket ist der Stand am ENDE der Periode.
 *
 * Der InfluxDB-Client kommt aus ./influxClient (INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG).
 */
import { queryApi } from './influxClient';

/* ------------------------------------------------------------------ */
/* Typen                                                               */
/* ------------------------------------------------------------------ */

/** Leistungen in W. Vorzeichen bei l*_w und total_w: positiv = Einspeisung, negativ = Bezug. */
export const POWER_METRICS = [
	'total_w',
	'total_w_buy',
	'total_w_sell',
	'l1_w',
	'l1_w_buy',
	'l1_w_sell',
	'l2_w',
	'l2_w_buy',
	'l2_w_sell',
	'l3_w',
	'l3_w_buy',
	'l3_w_sell'
] as const;

/** Zählerstände in kWh (aufsummiert). */
export const ENERGY_METRICS = ['kwh_buy', 'kwh_sell'] as const;

export const ALL_METRICS = [...POWER_METRICS, ...ENERGY_METRICS] as const;

export type PowerMetric = (typeof POWER_METRICS)[number];
export type EnergyMetric = (typeof ENERGY_METRICS)[number];
export type SmaMetric = PowerMetric | EnergyMetric;

export type Resolution = 'raw' | '15m' | '1h' | '1d' | '1mo' | '1y';
export type AggregatedResolution = Exclude<Resolution, 'raw'>;

export type SmaValues = Partial<Record<SmaMetric, number>>;
export type SmaPoint = { time: Date; values: SmaValues };
export type SmaCurrent = { time: Date | null; ageSeconds: number | null; values: SmaValues };
export type SmaSeries = { resolution: Resolution; points: SmaPoint[] };
export type EnergyPoint = { time: Date; kwhBuy: number; kwhSell: number };

/* ------------------------------------------------------------------ */
/* Konstanten                                                          */
/* ------------------------------------------------------------------ */

const H = 3_600_000;
const D = 24 * H;

const BUCKETS: Record<Resolution, string> = {
	raw: 'sma_raw',
	'15m': 'sma_15m',
	'1h': 'sma_1h',
	'1d': 'sma_1d',
	'1mo': 'sma_1mo',
	'1y': 'sma_1y'
};

/** Aufbewahrungsdauer je Bucket (muss zu den Buckets in InfluxDB passen). */
const RETENTION_MS: Record<Resolution, number> = {
	raw: 48 * H,
	'15m': 14 * D,
	'1h': 90 * D,
	'1d': 730 * D,
	'1mo': 1825 * D,
	'1y': Number.POSITIVE_INFINITY
};

/** Zusätzlicher Vorlauf, damit difference() für die erste Periode einen Vorgängerwert hat. */
const PAD_MS: Record<AggregatedResolution, number> = {
	'15m': 30 * 60_000,
	'1h': 2 * H,
	'1d': 2 * D,
	'1mo': 62 * D,
	'1y': 800 * D
};

const RESOLUTION_ORDER: Resolution[] = ['raw', '15m', '1h', '1d', '1mo', '1y'];

/* ------------------------------------------------------------------ */
/* Hilfsfunktionen                                                     */
/* ------------------------------------------------------------------ */

type Row = { _time: string; metric: string; _value: number };

const isMetric = (m: string): m is SmaMetric => (ALL_METRICS as readonly string[]).includes(m);
const isPower = (m: SmaMetric): m is PowerMetric => (POWER_METRICS as readonly string[]).includes(m);
const isEnergy = (m: SmaMetric): m is EnergyMetric => (ENERGY_METRICS as readonly string[]).includes(m);

const iso = (d: Date) => d.toISOString();

/** Gemeinsamer Filter: Measurement, Feld, Metrik-Whitelist. */
function baseFilter(metrics: readonly SmaMetric[]): string {
	const set = metrics.map((m) => `"${m}"`).join(', ');
	return `|> filter(fn: (r) => r._measurement == "sma_netz" and r._field == "value")
  |> filter(fn: (r) => contains(value: r.metric, set: [${set}]))`;
}

async function runRows(flux: string): Promise<Row[]> {
	return queryApi.collectRows<Row>(flux);
}

/** Zeilen (_time, metric, _value) → ein Punkt je Zeitstempel mit allen Metriken. */
function pivot(rows: Row[]): SmaPoint[] {
	const map = new Map<number, SmaPoint>();
	for (const r of rows) {
		if (!isMetric(r.metric)) continue;
		const t = new Date(r._time).getTime();
		let p = map.get(t);
		if (!p) {
			p = { time: new Date(t), values: {} };
			map.set(t, p);
		}
		p.values[r.metric] = r._value;
	}
	return [...map.values()].sort((a, b) => a.time.getTime() - b.time.getTime());
}

/* ------------------------------------------------------------------ */
/* Zeit-Helfer (Server-Zeitzone, sollte Europe/Berlin sein)            */
/* ------------------------------------------------------------------ */

export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
export const startOfYear = (d = new Date()) => new Date(d.getFullYear(), 0, 1);

/* ------------------------------------------------------------------ */
/* Auflösung automatisch wählen                                        */
/* ------------------------------------------------------------------ */

/**
 * Wählt anhand von Zeitspanne und Alter den passenden Bucket.
 * Reicht die Aufbewahrungsdauer nicht, wird die nächst gröbere Auflösung genommen.
 */
export function autoResolution(start: Date, stop: Date = new Date()): Resolution {
	const span = stop.getTime() - start.getTime();
	const age = Date.now() - start.getTime();

	const wanted: Resolution =
		span <= 6 * H
			? 'raw'
			: span <= 3 * D
				? '15m'
				: span <= 31 * D
					? '1h'
					: span <= 366 * D
						? '1d'
						: span <= 5 * 366 * D
							? '1mo'
							: '1y';

	for (let i = RESOLUTION_ORDER.indexOf(wanted); i < RESOLUTION_ORDER.length; i++) {
		if (age <= RETENTION_MS[RESOLUTION_ORDER[i]]) return RESOLUTION_ORDER[i];
	}
	return '1y';
}

/* ------------------------------------------------------------------ */
/* 1. Aktuelle Werte                                                   */
/* ------------------------------------------------------------------ */

/**
 * Neuester Wert jeder Metrik aus den letzten 5 Minuten.
 * `ageSeconds` zeigt das Alter des neuesten Werts – ist es groß, läuft sma2mqtt nicht.
 */
export async function getCurrent(): Promise<SmaCurrent> {
	const flux = `from(bucket: "${BUCKETS.raw}")
  |> range(start: -5m)
  ${baseFilter(ALL_METRICS)}
  |> last()
  |> keep(columns: ["_time", "metric", "_value"])`;

	const rows = await runRows(flux);

	const values: SmaValues = {};
	let newest = 0;
	for (const r of rows) {
		if (!isMetric(r.metric)) continue;
		values[r.metric] = r._value;
		newest = Math.max(newest, new Date(r._time).getTime());
	}

	return {
		time: newest ? new Date(newest) : null,
		ageSeconds: newest ? Math.round((Date.now() - newest) / 1000) : null,
		values
	};
}

/* ------------------------------------------------------------------ */
/* 2. Zeitreihen                                                       */
/* ------------------------------------------------------------------ */

export type SeriesOptions = {
	start: Date;
	stop?: Date;
	/** Standard: alle Metriken */
	metrics?: readonly SmaMetric[];
	/** Standard: automatisch nach Zeitspanne und Alter */
	resolution?: Resolution;
	/** Nur bei `raw`: Fenstergröße zum Glätten, z. B. "10s", "1m". Standard "10s". */
	every?: string;
};

/**
 * Zeitreihe der gewählten Metriken. Leistungen und Zählerstände werden getrennt
 * abgefragt (Mittelwert bzw. letzter Wert) und je Zeitstempel zusammengeführt.
 */
export async function getSeries(opts: SeriesOptions): Promise<SmaSeries> {
	const stop = opts.stop ?? new Date();
	const resolution = opts.resolution ?? autoResolution(opts.start, stop);
	const metrics = (opts.metrics ?? ALL_METRICS).filter(isMetric);

	const every =
		resolution === 'raw'
			? opts.every && /^\d+(s|m|h)$/.test(opts.every)
				? opts.every
				: '10s'
			: null;

	const build = (ms: SmaMetric[], fn: 'mean' | 'last'): string | null => {
		if (ms.length === 0) return null;
		const agg = every
			? `|> aggregateWindow(every: ${every}, fn: ${fn}, timeSrc: "_start", createEmpty: false)`
			: '';
		return `from(bucket: "${BUCKETS[resolution]}")
  |> range(start: ${iso(opts.start)}, stop: ${iso(stop)})
  ${baseFilter(ms)}
  ${agg}
  |> keep(columns: ["_time", "metric", "_value"])`;
	};

	const queries = [build(metrics.filter(isPower), 'mean'), build(metrics.filter(isEnergy), 'last')]
		.filter((q): q is string => q !== null)
		.map(runRows);

	const rows = (await Promise.all(queries)).flat();
	return { resolution, points: pivot(rows) };
}

/* ------------------------------------------------------------------ */
/* 3. Energie je Periode (Bezug / Einspeisung in kWh)                  */
/* ------------------------------------------------------------------ */

/**
 * Bezogene und eingespeiste Energie je Periode, berechnet aus der Differenz der
 * Zählerstände. Der Zeitstempel ist der Periodenbeginn.
 *
 *   getEnergy('1d', startOfMonth())   → Tageswerte des laufenden Monats
 *   getEnergy('1mo', startOfYear())   → Monatswerte des laufenden Jahres
 *   getEnergy('1h', startOfDay())     → Stundenwerte von heute
 *
 * Die laufende, noch unvollständige Periode enthält den Verbrauch bis zum letzten Task-Lauf.
 */
export async function getEnergy(
	resolution: AggregatedResolution,
	start: Date,
	stop: Date = new Date()
): Promise<EnergyPoint[]> {
	const padded = new Date(start.getTime() - PAD_MS[resolution]);

	const flux = `from(bucket: "${BUCKETS[resolution]}")
  |> range(start: ${iso(padded)}, stop: ${iso(stop)})
  ${baseFilter(ENERGY_METRICS)}
  |> difference(nonNegative: true)
  |> filter(fn: (r) => r._time >= ${iso(start)})
  |> keep(columns: ["_time", "metric", "_value"])`;

	const points = pivot(await runRows(flux));
	return points.map((p) => ({
		time: p.time,
		kwhBuy: p.values.kwh_buy ?? 0,
		kwhSell: p.values.kwh_sell ?? 0
	}));
}

/** Summe von Bezug und Einspeisung über einen Zeitraum (z. B. "heute", "dieser Monat"). */
export async function getEnergyTotal(
	resolution: AggregatedResolution,
	start: Date,
	stop: Date = new Date()
): Promise<{ kwhBuy: number; kwhSell: number }> {
	const points = await getEnergy(resolution, start, stop);
	return points.reduce(
		(sum, p) => ({ kwhBuy: sum.kwhBuy + p.kwhBuy, kwhSell: sum.kwhSell + p.kwhSell }),
		{ kwhBuy: 0, kwhSell: 0 }
	);
}

/* ------------------------------------------------------------------ */
/* 4. Bequeme Wrapper                                                  */
/* ------------------------------------------------------------------ */

/** Leistungsverlauf von heute (Gesamt + je Phase), automatisch geglättet. */
export const getTodayPower = () =>
	getSeries({
		start: startOfDay(),
		metrics: ['total_w', 'l1_w', 'l2_w', 'l3_w']
	});

/** Bezug/Einspeisung heute, diesen Monat, dieses Jahr in kWh. */
export async function getEnergySummary() {
	const [today, month, year] = await Promise.all([
		getEnergyTotal('1h', startOfDay()),
		getEnergyTotal('1d', startOfMonth()),
		getEnergyTotal('1mo', startOfYear())
	]);
	return { today, month, year };
}

/* ------------------------------------------------------------------ */
/* 5. Monatsübersicht für die Verbrauchs-Card                          */
/* ------------------------------------------------------------------ */

export type TagesVerbrauch = {
	/** Tag im Monat (1–31) */
	tag: number;
	/** Netzbezug in kWh, null = keine Daten */
	netzbezug: number | null;
	/** Einspeisung in kWh, null = keine Daten */
	einspeisung: number | null;
	/**
	 * PV-Anteil am Verbrauch (Eigenverbrauch) in kWh.
	 * Bleibt null, bis die PV-Erzeugung vom Wechselrichter in InfluxDB steht
	 * (Eigenverbrauch = Erzeugung − Einspeisung).
	 */
	pv: number | null;
};

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Tageswerte des Monats (Standard: laufender Monat) plus Netzbezug des Vormonats.
 * Der erste Tag mit Daten fehlt, weil für die Differenz ein Vorgänger-Zählerstand nötig ist.
 */
export async function getMonatsVerbrauch(
	monatStart: Date = startOfMonth()
): Promise<{ tage: TagesVerbrauch[]; vormonatNetzbezug: number }> {
	const y = monatStart.getFullYear();
	const m = monatStart.getMonth();
	const naechsterMonat = new Date(y, m + 1, 1);
	const vormonatStart = new Date(y, m - 1, 1);
	const tageImMonat = new Date(y, m + 1, 0).getDate();

	const [tagesPunkte, vormonat] = await Promise.all([
		getEnergy('1d', monatStart, naechsterMonat),
		getEnergyTotal('1mo', vormonatStart, monatStart)
	]);

	const proTag = new Map(tagesPunkte.map((p) => [p.time.getDate(), p]));

	const tage = Array.from({ length: tageImMonat }, (_, i): TagesVerbrauch => {
		const p = proTag.get(i + 1);
		return {
			tag: i + 1,
			netzbezug: p ? round2(p.kwhBuy) : null,
			einspeisung: p ? round2(p.kwhSell) : null,
			pv: null
		};
	});

	return { tage, vormonatNetzbezug: round2(vormonat.kwhBuy) };
}