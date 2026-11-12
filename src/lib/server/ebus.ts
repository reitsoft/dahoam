import { ebusStates, mqttClient } from './mqtt';

type Wert = string | number | null;

// {"temp": {"value": 30}} -> val('hmu/Status01', 'temp') = 30
// Einzelwerte: {"value": {"value": 44.9}} -> val('hmu/RunDataCompressorSpeed') = 44.9
function val(pfad: string, feld = 'value'): Wert {
	return (ebusStates.get(pfad)?.data?.[feld]?.value as Wert | undefined) ?? null;
}

const an = (x: Wert): boolean | null =>
	x === null ? null : x === 'on' || x === 1 || x === '1';

function fehler(device: string): unknown[] {
	const data = ebusStates.get(`${device}/Currenterror`)?.data ?? {};
	return Object.values(data)
		.map((f) => f?.value)
		.filter((x) => x !== null && x !== undefined);
}

function alter(pfad: string): number | null {
	const e = ebusStates.get(pfad);
	return e ? Math.round((Date.now() - e.zeit) / 1000) : null;
}

export function getEbusData() {
	const status = val('hmu/RunDataStatuscode');
	const drehzahl = val('hmu/RunDataCompressorSpeed');

	return {
		stand: new Date().toISOString(),
		mqtt_verbunden: mqttClient.connected,

		waermepumpe: {
			status,
			verdichter_laeuft: typeof drehzahl === 'number' ? drehzahl > 0 : null,
			verdichter_drehzahl_prozent: drehzahl,
			vorlauf_c: val('hmu/Status01', 'temp'),
			ruecklauf_c: val('hmu/Status01', 'temp_1'),
			interne_pumpe_an: an(val('hmu/Status01', 'pumpstate')),
			betriebsart: val('hmu/SetMode', 'hcmode'),
			vorlauf_soll_vom_regler_c: val('hmu/SetMode', 'flowtempdesired'),
			leistungsaufnahme_kw: val('hmu/PowerConsumptionHmu'),
			aufgenommene_leistung_regler_kw: val('hmu/CurrentConsumedPower'),
			waermeleistung_kw: val('hmu/CurrentYieldPower'),
			volumenstrom_heizkreis: val('hmu/BuildingCircuitFlow'),
			pumpenleistung_heizkreis: val('hmu/RunDataBuildingCPumpPower'),
			gradminuten: val('hmu/EnergyIntegral')
		},

		warmwasser: {
			aufbereitung_aktiv: typeof status === 'string' ? /hwc|dhw|water/i.test(status) : null,
			speichertemperatur_c: val('ctlv3/HwcStorageTemp'),
			solltemperatur_c: val('ctlv3/HwcTempDesired'),
			betriebsart: val('ctlv3/HwcOpMode'),
			parallelladung: val('ctlv3/HwcParallelLoading'),
			laden_gesperrt_vom_regler: an(val('hmu/SetMode', 'disablehwcload'))
		},

		heizkreis: {
			vorlauf_ist_c: val('ctlv3/Hc1FlowTemp'),
			vorlauf_soll_c: val('ctlv3/Hc1ActualFlowTempDesired'),
			systemvorlauf_c: val('ctlv3/SystemFlowTemp'),
			pumpe_laut_regler_an: an(val('ctlv3/Hc1PumpStatus')),
			heizkurve_anpassung: val('ctlv3/Hc1HeatCurveAdaption'),
			mischerkreis: {
				betrieb_an: an(val('vr_71/Mc1Operation', 'status')),
				pumpe_an: an(val('vr_71/Mc1Operation', 'pump')),
				mischer_stellung_prozent: val('vr_71/Mc1Operation', 'mixer'),
				vorlauf_soll_c: val('vr_71/Mc1Operation', 'flowtempdesired'),
				fuehler_1_c: val('vr_71/SensorData1', 's1'),
				fuehler_2_c: val('vr_71/SensorData1', 's2')
			}
		},

		raum: {
			betriebsart: val('ctlv3/Z1OpMode'),
			ist_c: val('ctlv3/Z1RoomTemp'),
			soll_aktuell_c: val('ctlv3/Z1ActualRoomTempDesired'),
			soll_tag_c: val('ctlv3/Z1DayTemp')
		},

		umwelt: {
			aussentemperatur_c: val('ctlv3/DisplayedOutsideTemp'),
			wasserdruck_bar: val('ctlv3/WaterPressure')
		},

		fehler: {
			waermepumpe: fehler('hmu'),
			regler: fehler('ctlv3')
		},

		datenalter_s: {
			status: alter('hmu/RunDataStatuscode'),
			vorlauf_ruecklauf: alter('hmu/Status01'),
			leistung: alter('hmu/PowerConsumptionHmu'),
			aussentemperatur: alter('ctlv3/DisplayedOutsideTemp'),
			warmwasser_speicher: alter('ctlv3/HwcStorageTemp'),
			raumtemperatur: alter('ctlv3/Z1RoomTemp')
		}
	};
}

// Alle empfangenen Rohdaten mit Zeitstempel (zum Entdecken weiterer Datenpunkte)
export function getEbusRaw() {
	return Object.fromEntries(
		[...ebusStates].map(([pfad, e]) => [
			pfad,
			{ zeit: new Date(e.zeit).toISOString(), daten: e.data }
		])
	);
}

const num = (x: Wert): number | null => (typeof x === 'number' ? x : null);

export function getHausKarte() {
	const d = getEbusData();

	const vorlauf = num(d.waermepumpe.vorlauf_c) ?? num(d.heizkreis.vorlauf_ist_c);
	const ruecklauf = num(d.waermepumpe.ruecklauf_c);
	const waermeKw = num(d.waermepumpe.waermeleistung_kw);
	const stromKw = num(d.waermepumpe.leistungsaufnahme_kw);

	return {
		datenVorhanden: d.waermepumpe.status !== null,
		raumTemp: num(d.raum.ist_c),
		aussenTemp: num(d.umwelt.aussentemperatur_c),
		warmwasserTemp: num(d.warmwasser.speichertemperatur_c),
		pumpeAn:
			d.heizkreis.pumpe_laut_regler_an === true || d.heizkreis.mischerkreis.pumpe_an === true,
		kompressorAn: d.waermepumpe.verdichter_laeuft === true,
		warmwasserAufbereitung: d.warmwasser.aufbereitung_aktiv === true,

		// Details für das Popup
		vorlaufTemp: vorlauf,
		vorlaufSollTemp:
			num(d.heizkreis.vorlauf_soll_c) ?? num(d.waermepumpe.vorlauf_soll_vom_regler_c),
		ruecklaufTemp: ruecklauf,
		spreizung: vorlauf !== null && ruecklauf !== null ? vorlauf - ruecklauf : null,
		raumSollTemp: num(d.raum.soll_aktuell_c),
		verdichterDrehzahl: num(d.waermepumpe.verdichter_drehzahl_prozent),
		waermeleistungKw: waermeKw,
		leistungsaufnahmeKw: stromKw,
		// COP nur sinnvoll, solange der Verdichter wirklich Strom zieht
		cop: waermeKw !== null && stromKw !== null && stromKw > 0.05 ? waermeKw / stromKw : null,
		volumenstrom: num(d.waermepumpe.volumenstrom_heizkreis),
		wasserdruck: num(d.umwelt.wasserdruck_bar)
	};
}

export type HausKarte = ReturnType<typeof getHausKarte>;