// routes/ebus/+page.server.js
import { env } from '$env/dynamic/private';
import { queryApi } from '$lib/server/influxClient';

async function run(flux) {
  const rows = [];
  for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
    rows.push(tableMeta.toObject(values));
  }
  return rows;
}

async function check(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`✅ ${name} (${Date.now() - start} ms)`, result);
    return { name, ok: true, ms: Date.now() - start, result };
  } catch (err) {
    console.error(`❌ ${name} (${Date.now() - start} ms):`, err.message);
    return { name, ok: false, ms: Date.now() - start, error: err.message };
  }
}

export async function load() {
  const checks = [];

  // 1) Server erreichbar? (kein Token nötig)
  checks.push(
    await check('Health', async () => {
      const res = await fetch(`${env.INFLUX_URL}/health`, {
        signal: AbortSignal.timeout(5000)
      });
      return await res.json(); // {"status":"pass", ...}
    })
  );

  // 2) Token gültig, Query läuft? Listet alle Buckets, die das Token sehen darf
  checks.push(
    await check('Buckets', async () => {
      const rows = await run(`buckets() |> keep(columns: ["name"])`);
      return rows.map((r) => r.name);
    })
  );

  // 3) Kommen aus sma_raw überhaupt Daten? Einfach 1 Punkt
  checks.push(
    await check('sma_raw (1 Punkt)', async () => {
      const rows = await run(`
        from(bucket: "sma_raw")
          |> range(start: -30d)
          |> limit(n: 1)
      `);
      return rows.length ? rows[0] : 'keine Daten im Zeitraum';
    })
  );

  return { checks };
}