// src/routes/api/ebus/+server.js
import { json } from '@sveltejs/kit';
import { getEbusData } from '$lib/server/ebus';

export function GET() {
	return json(getEbusData());
}
