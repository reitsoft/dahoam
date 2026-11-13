// src/routes/api/test-sma/+server.ts  (nur zum Testen, danach löschen)
import { json } from '@sveltejs/kit';
import { queryApi } from '$lib/server/influxClient';

const BUCKET = 'sma_raw';
const RANGE = '-7d'; // für wirklich alles: '0' (kann bei großem Bucket sehr viel sein)

async function run(flux: string): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
        const o = tableMeta.toObject(values);
        // Influx-Metaspalten ausblenden
        delete o.result;
        delete o.table;
        delete o._start;
        delete o._stop;
        rows.push(o);
    }
    return rows;
}

export const GET = async () => {
    // 1) Überblick: welche Measurements/Fields gibt es, wie viele Punkte
    const overview = await run(`
        from(bucket: "${BUCKET}")
            |> range(start: ${RANGE})
            |> group(columns: ["_measurement", "_field"])
            |> count()
    `);
    console.log(`\n=== ${BUCKET}: Überblick (${RANGE}) ===`);
    console.table(overview);

    // 2) Daten: je Serie die letzten 5 Punkte
    const daten = await run(`
        from(bucket: "${BUCKET}")
            |> range(start: ${RANGE})
            |> tail(n: 5)
    `);
    console.log(`\n=== ${BUCKET}: letzte 5 Punkte je Serie (${daten.length} Zeilen) ===`);
    console.table(daten);

    return json({ overview, daten });
};