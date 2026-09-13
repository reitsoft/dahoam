import { InfluxDB } from '@influxdata/influxdb-client';
import { env } from '$env/dynamic/private';

const client = new InfluxDB({ url: env.INFLUX_URL, token: env.INFLUX_TOKEN });
const queryApi = client.getQueryApi(env.INFLUX_ORG);

type DatenPunkt = { time: string; value: number | null };

export async function getVerbrauchProStunde(): Promise<DatenPunkt[]> {
    const flux = `
        import "date"
        import "timezone"

        option location = timezone.location(name: "Europe/Berlin")

        from(bucket: "${env.INFLUX_BUCKET}")
            |> range(start: date.truncate(t: now(), unit: 1d, location: location))
            |> filter(fn: (r) => r._measurement == "stromzaehler")
            |> filter(fn: (r) => r._field == "import_active")
            |> difference(nonNegative: true)
            |> aggregateWindow(every: 1h, fn: sum, createEmpty: false, location: location)
    `;

    const rawRows: Record<number, number> = {};

    for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
        const o = tableMeta.toObject(values);
        const hour = new Date(o._time).getHours();
        rawRows[hour] = o._value;
    }

    return fill24Hours(rawRows);
}

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

export async function getVerbrauchHeute(): Promise<number | null> {
    const flux = `
        import "date"
        import "timezone"

        option location = timezone.location(name: "Europe/Berlin")

        from(bucket: "${env.INFLUX_BUCKET}")
            |> range(start: date.truncate(t: now(), unit: 1d, location: location))
            |> filter(fn: (r) => r._measurement == "stromzaehler")
            |> filter(fn: (r) => r._field == "import_active")
            |> difference(nonNegative: true)
            |> sum()
    `;

    let result: number | null = null;

    try {
        for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
            const o = tableMeta.toObject(values);
            result = o._value;
        }
    } catch (err) {
        console.error('❌ Influx-Query fehlgeschlagen:', err);
    }

    return result;
}

export async function getVerbrauchMonat(): Promise<number | null> {
    const fluxHistorisch = `
        import "date"
        import "timezone"
        option location = timezone.location(name: "Europe/Berlin")

        from(bucket: "stromzaehler_1h")
            |> range(
                start: date.truncate(t: now(), unit: 1mo, location: location),
                stop: date.truncate(t: now(), unit: 1d, location: location)
            )
            |> filter(fn: (r) => r._measurement == "stromzaehler")
            |> filter(fn: (r) => r._field == "import_active")
            |> difference(nonNegative: true)
            |> sum()
    `;

    let historisch = 0;
    for await (const { values, tableMeta } of queryApi.iterateRows(fluxHistorisch)) {
        const o = tableMeta.toObject(values);
        historisch = o._value ?? 0;
    }

    const heute = (await getVerbrauchHeute()) ?? 0;

    return historisch + heute;
}

export async function getVerbrauchLetzte7Tage(): Promise<{ tag: string; value: number }[]> {
    const flux = `
        import "timezone"
        option location = timezone.location(name: "Europe/Berlin")

        from(bucket: "stromzaehler_1d")
            |> range(start: -7d)
            |> filter(fn: (r) => r._measurement == "stromzaehler")
            |> filter(fn: (r) => r._field == "import_active")
            |> difference(nonNegative: true)
            |> aggregateWindow(every: 1d, fn: sum, createEmpty: true, location: location)
    `;

    const rows: { time: string; value: number }[] = [];

    for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
        const o = tableMeta.toObject(values);
        rows.push({ time: o._time, value: o._value ?? 0 });
    }

    const tageKurz = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return rows.slice(-7).map((r) => ({
        tag: tageKurz[new Date(r.time).getDay()],
        value: Number(r.value.toFixed(1))
    }));
}

export async function getAktuelleLeistung(): Promise<number | null> {
    const flux = `
        from(bucket: "${env.INFLUX_BUCKET}")
            |> range(start: -1h)
            |> filter(fn: (r) => r._measurement == "stromzaehler")
            |> filter(fn: (r) => r._field == "power")
            |> last()
    `;

    let result: number | null = null;

    for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
        const o = tableMeta.toObject(values);
        result = o._value;
    }

    return result;
}

function fill24Hours(dataMap: Record<number, number>): DatenPunkt[] {
    const heute = new Date();
    
    return Array.from({ length: 24 }, (_, hour) => ({
        time: new Date(heute.setHours(hour, 0, 0, 0)).toISOString(),
        value: dataMap[hour] ?? null // 0 statt null verhindert den Tooltip-Crash
    }));
}