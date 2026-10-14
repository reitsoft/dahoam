/**
 * Gemeinsamer InfluxDB-Client für alle Server-Module.
 * Ablegen unter: src/lib/server/influxClient.ts
 *
 * Env (aus .env): INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG
 */
import { InfluxDB } from '@influxdata/influxdb-client';
import { env } from '$env/dynamic/private';

export const influxOrg = env.INFLUX_ORG ?? 'home';

export const influxClient = new InfluxDB({
	url: env.INFLUX_URL ?? 'http://192.168.0.100:8086',
	token: env.INFLUX_TOKEN ?? ''
});

export const queryApi = influxClient.getQueryApi(influxOrg);