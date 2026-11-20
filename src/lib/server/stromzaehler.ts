// src/lib/server/stronzaehler.ts
import { env } from '$env/dynamic/private';
import { queryApi } from './influxClient';
export async function getAktuellerZaehlerstand(): Promise<number | null> {
    const flux = `
        from(bucket: "${env.INFLUX_BUCKET}")
            |> range(start: -1h)
            |> filter(fn: (r) => r._measurement == "stromzaehler")
            |> filter(fn: (r) => r._field == "import_active")
            |> last()
    `;
    let result: number | null = null;
    for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
        const o = tableMeta.toObject(values);
        result = o._value;
    }
    return result;
}
