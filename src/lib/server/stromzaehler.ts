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
    // Greift den Zeitraum vom 1. des Monats 00:00 Uhr bis heute 00:00 Uhr ab
    const fluxHistorisch = `
        import "date"
        import "timezone"
        option location = timezone.location(name: "Europe/Berlin")
        startMonat = date.truncate(t: now(), unit: 1mo, location: location)
        heuteMitternacht = date.truncate(t: now(), unit: 1d, location: location)
        from(bucket: "stromzaehler_1d")
            |> range(start: startMonat, stop: heuteMitternacht)
            |> filter(fn: (r) => r._measurement == "stromzaehler")
            |> filter(fn: (r) => r._field == "import_active")
            |> spread()
    `;
    let historisch = 0;
    try {
        for await (const { values, tableMeta } of queryApi.iterateRows(fluxHistorisch)) {
            const o = tableMeta.toObject(values);
            if (o._value !== undefined && o._value !== null) {
                historisch = o._value;
            }
        }
    } catch (err) {
        console.error('❌ Fehler bei getVerbrauchMonat() historisch:', err);
    }
    // Heutigen Live-Verbrauch addieren
    const heute = (await getVerbrauchHeute()) ?? 0;
    return historisch + heute;
}
export async function getVerbrauchProMonatJahr(
    jahr: number = new Date().getFullYear()
): Promise<(number | null)[]> {
    // Januar/Dezember = CET (+01:00), daher sind die Jahresgrenzen als Literal eindeutig
    const flux = `
        import "date"
        import "timezone"
        option location = timezone.location(name: "Europe/Berlin")
        startJahr = time(v: "${jahr}-01-01T00:00:00+01:00")
        endeJahr = time(v: "${jahr + 1}-01-01T00:00:00+01:00")
        from(bucket: "stromzaehler_1d")
            |> range(start: date.add(d: -1d, to: startJahr), stop: endeJahr)
            |> filter(fn: (r) => r._measurement == "stromzaehler")
            |> filter(fn: (r) => r._field == "import_active")
            |> aggregateWindow(every: 1d, fn: max, createEmpty: false, location: location)
            |> difference(nonNegative: true)
            |> filter(fn: (r) => r._time >= startJahr)
            |> aggregateWindow(every: 1mo, fn: sum, createEmpty: false, timeSrc: "_start", location: location)
    `;
    const monatsFormat = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Berlin',
        month: 'numeric'
    });
    const werteProMonat: Record<number, number> = {};
    try {
        for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
            const o = tableMeta.toObject(values);
            if (o._value !== null && o._value !== undefined) {
                const monat = parseInt(monatsFormat.format(new Date(o._time)), 10); // 1–12
                werteProMonat[monat] = o._value;
            }
        }
    } catch (err) {
        console.error('❌ Fehler bei getVerbrauchProMonatJahr():', err);
    }
    const now = new Date();
    const aktuellesJahr = now.getFullYear();
    const aktuellerMonat = now.getMonth() + 1;
    // Laufenden Monat: gestern und früher stehen im 1d-Bucket, heute kommt live dazu
    if (jahr === aktuellesJahr) {
        const heute = (await getVerbrauchHeute()) ?? 0;
        werteProMonat[aktuellerMonat] = (werteProMonat[aktuellerMonat] ?? 0) + heute;
    }
    return Array.from({ length: 12 }, (_, i) => {
        const monat = i + 1;
        if (jahr > aktuellesJahr) return null;
        if (jahr === aktuellesJahr && monat > aktuellerMonat) return null;
        return werteProMonat[monat] ?? 0;
    });
}
