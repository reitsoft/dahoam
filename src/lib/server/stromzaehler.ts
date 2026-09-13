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

export async function getVerbrauchProTagMonat(): Promise<{ tag: number; value: number | null }[]> {
    const now = new Date();
    const heuteTag = now.getDate();
    const tageImMonat = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Range startet 1 Tag vor Monatsanfang, damit Tag 1 eine Differenz hat
    const flux = `
        import "date"
        import "timezone"

        option location = timezone.location(name: "Europe/Berlin")

        startMonat = date.truncate(t: now(), unit: 1mo, location: location)
        startRange = date.add(d: -1d, to: startMonat)

        from(bucket: "stromzaehler_1d")
            |> range(start: startRange)
            |> filter(fn: (r) => r._measurement == "stromzaehler")
            |> filter(fn: (r) => r._field == "import_active")
            |> aggregateWindow(every: 1d, fn: max, createEmpty: false, location: location)
            |> difference(nonNegative: true)
            |> filter(fn: (r) => r._time >= startMonat)
    `;

    const werteProTag: Record<number, number> = {};

    for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
        const o = tableMeta.toObject(values);
        if (o._value !== null && o._value !== undefined) {
            // Datum korrekt in deutscher Zeitzone parsen
            const tag = new Date(o._time).getDate();
            werteProTag[tag] = o._value;
        }
    }

    // Heutigen (unvollständigen) Tag durch Live-Wert aus getVerbrauchHeute() überschreiben
    const heuteWert = await getVerbrauchHeute();
    if (heuteWert !== null) {
        werteProTag[heuteTag] = heuteWert;
    }

    return Array.from({ length: tageImMonat }, (_, i) => {
        const tag = i + 1;
        // Zukünftige Tage im Monat auf null setzen
        if (tag > heuteTag) return { tag, value: null };
        return { tag, value: werteProTag[tag] ?? 0 };
    });
}

export async function getVerbrauchVormonat(): Promise<number> {
    const flux = `
        import "date"
        import "timezone"

        option location = timezone.location(name: "Europe/Berlin")

        vormonatsStart = date.truncate(t: date.sub(d: 1mo, from: now()), unit: 1mo, location: location)
        vormonatsEnde = date.truncate(t: now(), unit: 1mo, location: location)

        from(bucket: "stromzaehler_1d")
            |> range(start: vormonatsStart, stop: vormonatsEnde)
            |> filter(fn: (r) => r._measurement == "stromzaehler")
            |> filter(fn: (r) => r._field == "import_active")
            |> difference(nonNegative: true)
            |> sum()
    `;

    let result = 0;
    for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
        const o = tableMeta.toObject(values);
        result = o._value ?? 0;
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