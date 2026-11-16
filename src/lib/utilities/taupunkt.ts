/**
 * taupunkt.ts
 * Taupunkt-Berechnung nach Magnus-Formel sowie Lüftungs-/Kondensations-Checks
 * für Kellerlüftung und Feuchteschutz-Automatisierungen.
 *
 * Gültigkeitsbereich der Magnus-Näherung (Sonntag 1990, über flüssigem Wasser):
 * ca. −45 °C bis +60 °C. Unterhalb von 0 °C ist die Näherung über Eis minimal
 * abweichend, für die Lüftungsentscheidung aber ausreichend genau.
 *
 * Designprinzip: Ungültige Eingaben (NaN, null, außerhalb des Bereichs) führen
 * nie zu einer positiven Empfehlung, sondern zu `null`. Keine Exceptions im
 * Render-Pfad.
 */

// Magnus-Koeffizienten für Wasser
const MAGNUS_A = 17.62;
const MAGNUS_B = 243.12; // °C

const TEMP_MIN_C = -45;
const TEMP_MAX_C = 60;
/** Sensoren liefern gelegentlich leicht über 100 %; bis hierhin wird auf 100 geklemmt. */
const RH_TOLERANZ_MAX = 105;

function istZahl(n: unknown): n is number {
	return typeof n === 'number' && Number.isFinite(n);
}

/**
 * Berechnet den Taupunkt einer Luftmasse.
 * @param tempC       Lufttemperatur in °C
 * @param rhPercent   relative Luftfeuchte in % (0 < rH <= 100, bis 105 wird auf 100 geklemmt)
 * @returns Taupunkt in °C oder `null` bei ungültigen Eingaben
 */
export function taupunkt(tempC: number, rhPercent: number): number | null {
	if (!istZahl(tempC) || !istZahl(rhPercent)) return null;
	if (tempC < TEMP_MIN_C || tempC > TEMP_MAX_C) return null;
	if (rhPercent <= 0 || rhPercent > RH_TOLERANZ_MAX) return null;

	const rh = Math.min(rhPercent, 100);
	const gamma = Math.log(rh / 100) + (MAGNUS_A * tempC) / (MAGNUS_B + tempC);
	return (MAGNUS_B * gamma) / (MAGNUS_A - gamma);
}

/**
 * Sättigungsdampfdruck nach Magnus in hPa, `null` bei ungültiger Temperatur.
 */
export function saettigungsdampfdruck(tempC: number): number | null {
	if (!istZahl(tempC) || tempC < TEMP_MIN_C || tempC > TEMP_MAX_C) return null;
	return 6.112 * Math.exp((MAGNUS_A * tempC) / (MAGNUS_B + tempC));
}

/**
 * Absolute Luftfeuchte in g/m³, `null` bei ungültigen Eingaben.
 * Nützlich, um Innen und Außen direkt zu vergleichen.
 */
export function absoluteFeuchte(tempC: number, rhPercent: number): number | null {
	const es = saettigungsdampfdruck(tempC);
	if (es === null || !istZahl(rhPercent) || rhPercent <= 0 || rhPercent > RH_TOLERANZ_MAX) {
		return null;
	}
	const rh = Math.min(rhPercent, 100);
	const e = (rh / 100) * es; // hPa
	return (216.7 * e) / (tempC + 273.15);
}

// ---------------------------------------------------------------------------
// Kondensationsrisiko (nur Wandseite)
// ---------------------------------------------------------------------------

export interface KondensationsRisikoInput {
	/** Temperatur der einströmenden Luft (z. B. Außenluft) in °C */
	quellTempC: number;
	/** relative Feuchte der einströmenden Luft in % */
	quellFeuchtePercent: number;
	/** Temperatur der Fläche, an der Kondensation entstehen könnte (z. B. Kellerwand) in °C */
	oberflaechenTempC: number;
	/** Mindestabstand in Kelvin zwischen Oberflächentemperatur und Taupunkt (Default 2 K) */
	sicherheitsabstandK?: number;
}

export interface KondensationsRisikoResult {
	/** Taupunkt der Quellluft in °C */
	taupunktC: number;
	/** true, wenn oberflaechenTempC − taupunktC < sicherheitsabstandK */
	risiko: boolean;
	/** Abstand Oberflächentemperatur − Taupunkt in Kelvin (negativ = Kondensation findet statt) */
	abstandK: number;
}

/**
 * Prüft, ob beim Einströmen der Quellluft Kondensation an einer kälteren Fläche
 * zu erwarten ist. Gibt bei ungültigen Eingaben `null` zurück (nie "kein Risiko").
 */
export function kondensationsRisiko(
	input: KondensationsRisikoInput
): KondensationsRisikoResult | null {
	const { quellTempC, quellFeuchtePercent, oberflaechenTempC, sicherheitsabstandK = 2 } = input;

	if (!istZahl(oberflaechenTempC) || !istZahl(sicherheitsabstandK)) return null;

	const tp = taupunkt(quellTempC, quellFeuchtePercent);
	if (tp === null) return null;

	const abstandK = oberflaechenTempC - tp;
	return {
		taupunktC: tp,
		risiko: abstandK < sicherheitsabstandK,
		abstandK
	};
}

// ---------------------------------------------------------------------------
// Lüftungs-Check (Wandseite + Feuchtebilanz)
// ---------------------------------------------------------------------------

export type LueftStatus = 'kondensation' | 'befeuchtend' | 'ok';

export interface LueftungsCheckInput {
	aussenTempC: number;
	aussenFeuchte: number;
	kellerTempC: number;
	kellerFeuchte: number;
	/** Mindestabstand Kellertemperatur − Taupunkt(außen) in K (Default 2) */
	sicherheitsabstandK?: number;
	/** Taupunkt(außen) muss mindestens so weit unter Taupunkt(Keller) liegen (Default 1 K) */
	mindestGewinnK?: number;
}

export interface LueftungsCheckResult {
	status: LueftStatus;
	/** true nur bei status === 'ok' */
	lueftenSinnvoll: boolean;
	tpAussenC: number;
	tpKellerC: number;
	/** Kellertemperatur − Taupunkt(außen) in K */
	abstandK: number;
	/** Taupunkt(Keller) − Taupunkt(außen) in K; positiv = Lüften trocknet */
	gewinnK: number;
	/** verwendeter Mindestabstand Wand/Taupunkt in K */
	sicherheitsabstandK: number;
	/** verwendeter Mindest-Taupunktgewinn in K */
	mindestGewinnK: number;
}

/**
 * Entscheidet, ob Lüften sinnvoll ist:
 *  1. 'kondensation': Außenluft würde an der Kellerfläche kondensieren
 *  2. 'befeuchtend':  Außenluft ist absolut feuchter als die Kellerluft (Lüften bringt Feuchte rein)
 *  3. 'ok':           Lüften trocknet den Keller ohne Kondensationsrisiko
 *
 * Gibt bei ungültigen Eingaben `null` zurück; der Aufrufer darf dann nie "grün" anzeigen.
 */
export function lueftungsCheck(input: LueftungsCheckInput): LueftungsCheckResult | null {
	const { sicherheitsabstandK = 2, mindestGewinnK = 1 } = input;

	if (!istZahl(input.kellerTempC) || !istZahl(sicherheitsabstandK) || !istZahl(mindestGewinnK)) {
		return null;
	}

	const tpAussenC = taupunkt(input.aussenTempC, input.aussenFeuchte);
	const tpKellerC = taupunkt(input.kellerTempC, input.kellerFeuchte);
	if (tpAussenC === null || tpKellerC === null) return null;

	const abstandK = input.kellerTempC - tpAussenC;
	const gewinnK = tpKellerC - tpAussenC;

	const status: LueftStatus =
		abstandK < sicherheitsabstandK
			? 'kondensation'
			: gewinnK < mindestGewinnK
				? 'befeuchtend'
				: 'ok';

	return {
		status,
		lueftenSinnvoll: status === 'ok',
		tpAussenC,
		tpKellerC,
		abstandK,
		gewinnK,
		sicherheitsabstandK,
		mindestGewinnK
	};
}