// src/lib/server/stromzaehler.ts
import { env } from '$env/dynamic/private';
import { queryApi } from './influxClient';

export type ZaehlerDaten = {
	importActive: number | null;
	exportActive: number | null;
	power: number | null;
	voltageL1: number | null;
	voltageL2: number | null;
	voltageL3: number | null;
	/** Zeitstempel des neuesten Werts (ISO) */
	zeit: string | null;
};

export async function getZaehlerDaten(): Promise<ZaehlerDaten> {
	const flux = `
		from(bucket: "${env.INFLUX_BUCKET}")
			|> range(start: -15m)
			|> filter(fn: (r) => r._measurement == "stromzaehler")
			|> last()
			|> keep(columns: ["_field", "_value", "_time"])
	`;

	const f: Record<string, number> = {};
	let zeit: string | null = null;

	for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
		const o = tableMeta.toObject(values);
		f[o._field] = Number(o._value);
		if (!zeit || o._time > zeit) zeit = o._time;
	}

	return {
		importActive: f.import_active ?? null,
		exportActive: f.export_active ?? null,
		power: f.power ?? null,
		voltageL1: f.voltage_l1 ?? null,
		voltageL2: f.voltage_l2 ?? null,
		voltageL3: f.voltage_l3 ?? null,
		zeit
	};
}
