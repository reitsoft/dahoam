// routes/ebus/+page.server.js
import { queryApi } from '$lib/server/influxClient';

// @ts-ignore
async function run(flux) {
  const rows = [];
  for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
    const o = tableMeta.toObject(values);
    rows.push({ zeit: o._time, wert: o._value });
  }
  return rows;
}

export async function load() {
  const tag = await run(`
    from(bucket: "sma_1d")
      |> range(start: -5d)
      |> filter(fn: (r) => r._measurement == "sma_netz" and r.metric == "kwh_buy")
  `);

  const rawLast = await run(`
    import "timezone"
    option location = timezone.location(name: "Europe/Berlin")

    from(bucket: "sma_raw")
      |> range(start: -3d)
      |> filter(fn: (r) => r._measurement == "sma_netz" and r.metric == "kwh_buy")
      |> aggregateWindow(every: 1d, fn: last, createEmpty: false)
  `);

  console.log('sma_1d (kwh_buy)'); console.table(tag);
  console.log('sma_raw, last pro Berliner Tag'); console.table(rawLast);
  return { tag, rawLast };
}