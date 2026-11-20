/**
 * SMA Sunny Home Manager 2.0 – Datenzugriff auf InfluxDB (nur Netzbezug / Einspeisung)
 *
 * Ablegen unter: src/lib/server/smaHomeManager.ts
 *
 * Datenquelle (Measurement `sma_netz`, Feld `value`, Tag `metric`):
 *   sma_raw  (48 h)     Rohdaten, ca. 1 Wert/s
 *   sma_1d   (2 Jahre)  Tageswerte
 *   sma_1mo  (5 Jahre)  Monatswerte
 *
 * Zählerstände (kWh) sind in aggregierten Buckets der LETZTE Wert der Periode.
 * Der Zeitstempel ist der BEGINN der Periode (Tage/Monate in Europe/Berlin).
 *
 * Der InfluxDB-Client kommt aus ./influxClient (INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG).
 */
import { queryApi } from './influxClient';

/* ------------------------------------------------------------------ */
/* Typen und Konstanten                                                */
/* ------------------------------------------------------------------ */

/** Zählerstände in kWh (aufsummiert). */
const ENERGY_METRICS = ['kwh_buy', 'kwh_sell'] as const;
type EnergyMetric = (typeof ENERGY_METRICS)[number];
type Resolution = 'raw' | '1d' | '1mo';
type AggregatedResolution = Exclude<Resolution, 'raw'>;
type SmaValues = Partial<Record<EnergyMetric, number>>;
type SmaPoint = { time: Date; values: SmaValues };
type EnergyPoint = { time: Date; kwhBuy: number; kwhSell: number };

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

const H = 3_600_000;
const D = 24 * H;
const BUCKETS: Record<Resolution, string> = {
	raw: 'sma_raw',
	'1d': 'sma_1d',
	'1mo': 'sma_1mo'
};
/** Zusätzlicher Vorlauf, damit difference() für die erste Periode einen Vorgängerwert hat. */
const PAD_MS: Record<AggregatedResolution, number> = {
	'1d': 2 * D,
	'1mo': 62 * D
};

/* ------------------------------------------------------------------ */
/* Hilfsfunktionen                                                     */
/* ------------------------------------------------------------------ */

type Row = { _time: string; metric: string; _value: number };

const isMetric = (m: string): m is EnergyMetric => (ENERGY_METRICS as readonly string[]).includes(m);
const iso = (d: Date) => d.toISOString();
const round2 = (v: number) => Math.round(v * 100) / 100;
const summe = (tage: TagesVerbrauch[]) => round2(tage.reduce((s, t) => s + (t.netzbezug ?? 0), 0));

/** Gemeinsamer Filter: Measurement, Feld, Metrik-Whitelist (als == / or, damit er in InfluxDB vorgezogen wird). */
function energyFilter(): string {
	const alt = ENERGY_METRICS.map((m) => `r.metric == "${m}"`).join(' or ');
	return `|> filter(fn: (r) => r._measurement == "sma_netz" and r._field == "value" and (${alt}))`;
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
/* Zeit-Helfer (Europe/Berlin)                                         */
/* ------------------------------------------------------------------ */

const berlinFmt = new Intl.DateTimeFormat('en-US', {
	timeZone: 'Europe/Berlin',
	year: 'numeric',
	month: 'numeric',
	day: 'numeric',
	hour: 'numeric',
	minute: 'numeric',
	second: 'numeric',
	hourCycle: 'h23'
});

function berlinParts(d = new Date()) {
	const p = Object.fromEntries(
		berlinFmt
			.formatToParts(d)
			.filter((x) => x.type !== 'literal')
			.map((x) => [x.type, Number(x.value)])
	);
	return { jahr: p.year, monat: p.month, tag: p.day, stunde: p.hour, minute: p.minute, sekunde: p.second };
}

/** Berliner Mitternacht (Monat 1–12, über 0/13 wird korrekt umgebrochen) als echter Zeitpunkt. */
function berlinMitternacht(jahr: number, monat: number, tag = 1): Date {
	const utcGuess = Date.UTC(jahr, monat - 1, tag);
	const b = berlinParts(new Date(utcGuess));
	const offset = Date.UTC(b.jahr, b.monat - 1, b.tag, b.stunde, b.minute, b.sekunde) - utcGuess;
	return new Date(utcGuess - offset);
}

const startOfDay = (d = new Date()) => {
	const b = berlinParts(d);
	return berlinMitternacht(b.jahr, b.monat, b.tag);
};
const startOfMonth = (d = new Date()) => {
	const b = berlinParts(d);
	return berlinMitternacht(b.jahr, b.monat, 1);
};

/* ------------------------------------------------------------------ */
/* Energie je Periode (Bezug / Einspeisung in kWh)                     */
/* ------------------------------------------------------------------ */

/**
 * Bezogene und eingespeiste Energie je Periode, berechnet aus der Differenz der
 * Zählerstände. Der Zeitstempel ist der Periodenbeginn.
 *
 *   getEnergy('1d', startOfMonth())   → Tageswerte des laufenden Monats
 *   getEnergy('1mo', Jahresbeginn)    → Monatswerte des Jahres
 *
 * Die laufende, noch unvollständige Periode enthält den Verbrauch bis zum letzten Task-Lauf.
 */
async function getEnergy(
	resolution: AggregatedResolution,
	start: Date,
	stop: Date = new Date()
): Promise<EnergyPoint[]> {
	const padded = new Date(start.getTime() - PAD_MS[resolution]);
	const flux = `from(bucket: "${BUCKETS[resolution]}")
  |> range(start: ${iso(padded)}, stop: ${iso(stop)})
  ${energyFilter()}
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

/** Summe von Bezug und Einspeisung über einen Zeitraum. */
async function getEnergyTotal(
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

/** Bezug/Einspeisung seit Berliner Mitternacht: aktueller Stand (raw) − Endstand gestern (1d). */
async function getHeuteLive(): Promise<{ kwhBuy: number; kwhSell: number } | null> {
	const heute = startOfDay();
	const gesternFlux = `from(bucket: "${BUCKETS['1d']}")
  |> range(start: ${iso(new Date(heute.getTime() - 36 * H))}, stop: ${iso(heute)})
  ${energyFilter()}
  |> last()
  |> keep(columns: ["_time", "metric", "_value"])`;
	// 2 Tage Vorlauf: kwh_sell wird nachts u. U. nur selten geschrieben
	const jetztFlux = `from(bucket: "${BUCKETS.raw}")
  |> range(start: -2d)
  ${energyFilter()}
  |> last()
  |> keep(columns: ["_time", "metric", "_value"])`;
	const [g, j] = await Promise.all([
		runRows(gesternFlux).then(pivot),
		runRows(jetztFlux).then(pivot)
	]);
	// kwh_buy und kwh_sell haben bei last() unterschiedliche Zeitstempel, daher zusammenführen
	const merge = (pts: SmaPoint[]) => Object.assign({}, ...pts.map((p) => p.values)) as SmaValues;
	const gest = merge(g);
	const jetzt = merge(j);
	if (
		gest.kwh_buy === undefined ||
		gest.kwh_sell === undefined ||
		jetzt.kwh_buy === undefined ||
		jetzt.kwh_sell === undefined
	)
		return null;
	return {
		kwhBuy: Math.max(0, jetzt.kwh_buy - gest.kwh_buy),
		kwhSell: Math.max(0, jetzt.kwh_sell - gest.kwh_sell)
	};
}

/**
 * Tageswerte eines Monats. Der laufende Tag wird mit dem Live-Wert überschrieben
 * (der 1d-Punkt wird nicht laufend aktualisiert). Der erste Tag mit Daten fehlt,
 * weil für die Differenz ein Vorgänger-Zählerstand nötig ist.
 */
async function ladeTage(monatStart: Date): Promise<TagesVerbrauch[]> {
	const { jahr, monat } = berlinParts(monatStart);
	const naechsterMonat = berlinMitternacht(jahr, monat + 1);
	const tageImMonat = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
	const jetzt = berlinParts();
	const istLaufend = jetzt.jahr === jahr && jetzt.monat === monat;

	const [tagesPunkte, live] = await Promise.all([
		getEnergy('1d', monatStart, naechsterMonat),
		istLaufend ? getHeuteLive() : Promise.resolve(null)
	]);

	const proTag = new Map(tagesPunkte.map((p) => [berlinParts(p.time).tag, p]));
	const tage = Array.from({ length: tageImMonat }, (_, i): TagesVerbrauch => {
		const p = proTag.get(i + 1);
		return {
			tag: i + 1,
			netzbezug: p ? round2(p.kwhBuy) : null,
			einspeisung: p ? round2(p.kwhSell) : null,
			pv: null
		};
	});
	if (live) {
		const heute = tage[jetzt.tag - 1];
		heute.netzbezug = round2(live.kwhBuy);
		heute.einspeisung = round2(live.kwhSell);
	}
	return tage;
}

/* ------------------------------------------------------------------ */
/* Öffentliche API                                                     */
/* ------------------------------------------------------------------ */

/** Tageswerte des Monats (Standard: laufender Monat) plus Netzbezug des Vormonats. */
export async function getMonatsVerbrauch(
	monatStart: Date = startOfMonth()
): Promise<{ tage: TagesVerbrauch[]; vormonatNetzbezug: number }> {
	const { jahr, monat } = berlinParts(monatStart);
	const vormonatStart = berlinMitternacht(jahr, monat - 1);
	const [tage, vormonat] = await Promise.all([
		ladeTage(monatStart),
		getEnergyTotal('1mo', vormonatStart, monatStart)
	]);
	return { tage, vormonatNetzbezug: round2(vormonat.kwhBuy) };
}

/** Netzbezug heute und im laufenden Monat in kWh (null = keine Daten für heute). */
export async function getNetzbezugHeuteUndMonat(): Promise<{
	heute: number | null;
	monat: number;
}> {
	const tage = await ladeTage(startOfMonth());
	return { heute: tage[berlinParts().tag - 1].netzbezug, monat: summe(tage) };
}

/**
 * Netzbezug je Monat eines Jahres (12 Werte, Jan–Dez) in kWh.
 * null = Monat liegt in der Zukunft. Der laufende Monat wird aus den Tageswerten
 * inkl. Live-Wert gebildet, weil der 1mo-Punkt nicht laufend aktualisiert wird.
 */
export async function getNetzbezugProMonatJahr(
	jahr: number = berlinParts().jahr
): Promise<(number | null)[]> {
	const jetzt = berlinParts();
	if (jahr > jetzt.jahr) return Array(12).fill(null);

	const istLaufendesJahr = jahr === jetzt.jahr;
	const [monatsPunkte, laufenderMonat] = await Promise.all([
		getEnergy('1mo', berlinMitternacht(jahr, 1), berlinMitternacht(jahr + 1, 1)),
		istLaufendesJahr ? ladeTage(berlinMitternacht(jahr, jetzt.monat)) : Promise.resolve(null)
	]);

	const proMonat = new Map(monatsPunkte.map((p) => [berlinParts(p.time).monat, p.kwhBuy]));
	return Array.from({ length: 12 }, (_, i) => {
		const m = i + 1;
		if (istLaufendesJahr && m > jetzt.monat) return null;
		if (istLaufendesJahr && m === jetzt.monat && laufenderMonat) return summe(laufenderMonat);
		return round2(proMonat.get(m) ?? 0);
	});
}
